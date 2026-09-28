import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/prisma";
import { registerContextualVisitor } from "./quick-visitor-service";

const fault = vi.hoisted(() => ({ failPersonAudit: false }));

vi.mock("../../server/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server/audit")>();
  return {
    ...actual,
    recordAuditEvent: (...args: Parameters<typeof actual.recordAuditEvent>) => {
      const [, input] = args;
      if (fault.failPersonAudit && input.targetType === "Person") {
        throw new Error("Injected audit failure");
      }
      return actual.recordAuditEvent(...args);
    },
  };
});

describe("contextual visitor registration", () => {
  const suffix = Date.now().toString();
  let leaderId: string;
  let leaderPersonId: string;
  let ministryId: string;
  let outsideMinistryId: string;
  let categoryId: string;
  let meetingId: string;
  let outsideMeetingId: string;

  const actor = () => ({
    id: leaderId,
    role: "LEADER" as const,
    ministryAccess: [{ ministryId, revokedAt: null }],
  });

  beforeAll(async () => {
    const leaderPerson = await prisma.person.create({ data: { fullName: `Líder visitante ${suffix}` } });
    leaderPersonId = leaderPerson.id;
    const leader = await prisma.account.create({
      data: {
        personId: leaderPersonId,
        username: `leader-visitor-${suffix}`,
        email: `leader-visitor-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "LEADER",
      },
    });
    leaderId = leader.id;
    const [ministry, outsideMinistry] = await Promise.all([
      prisma.ministry.create({ data: { name: `Ministério visitante ${suffix}` } }),
      prisma.ministry.create({ data: { name: `Ministério fora do escopo visitante ${suffix}` } }),
    ]);
    ministryId = ministry.id;
    outsideMinistryId = outsideMinistry.id;
    await prisma.accountMinistryAccess.create({ data: { accountId: leaderId, ministryId } });

    const category = await prisma.category.create({ data: { name: `Categoria visitante ${suffix}` } });
    categoryId = category.id;
    const [meeting, outsideMeeting] = await Promise.all([
      prisma.meeting.create({
        data: {
          categoryId,
          title: `Encontro visitante ${suffix}`,
          scheduledAt: new Date(),
          status: "SCHEDULED",
          audiences: { create: { ministryId } },
        },
      }),
      prisma.meeting.create({
        data: {
          categoryId,
          title: `Encontro fora do escopo ${suffix}`,
          scheduledAt: new Date(),
          status: "SCHEDULED",
          audiences: { create: { ministryId: outsideMinistryId } },
        },
      }),
    ]);
    meetingId = meeting.id;
    outsideMeetingId = outsideMeeting.id;
  });

  beforeEach(async () => {
    fault.failPersonAudit = false;
    const visitors = await prisma.person.findMany({
      where: { AND: [{ fullName: { startsWith: "Visitante" } }, { fullName: { contains: suffix } }] },
      select: { id: true },
    });
    const visitorIds = visitors.map((person) => person.id);
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: visitorIds } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: visitorIds } } });
    await prisma.attendance.deleteMany({ where: { personId: { in: visitorIds } } });
    await prisma.person.deleteMany({ where: { id: { in: visitorIds } } });
    await prisma.account.update({ where: { id: leaderId }, data: { status: "ACTIVE" } });
    await prisma.accountMinistryAccess.update({
      where: { accountId_ministryId: { accountId: leaderId, ministryId } },
      data: { revokedAt: null },
    });
    await prisma.ministry.updateMany({ where: { id: { in: [ministryId, outsideMinistryId] } }, data: { status: "ACTIVE" } });
    await prisma.meeting.updateMany({ where: { id: { in: [meetingId, outsideMeetingId] } }, data: { status: "SCHEDULED" } });
  });

  afterAll(async () => {
    const people = await prisma.person.findMany({ where: { fullName: { contains: suffix } }, select: { id: true } });
    const personIds = people.map((person) => person.id);
    await prisma.auditEvent.deleteMany({ where: { OR: [{ actorId: leaderId }, { targetId: { in: personIds } }] } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.attendance.deleteMany({ where: { meetingId: { in: [meetingId, outsideMeetingId] } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: { in: [meetingId, outsideMeetingId] } } });
    await prisma.meeting.deleteMany({ where: { id: { in: [meetingId, outsideMeetingId] } } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: leaderId } });
    await prisma.ministry.deleteMany({ where: { id: { in: [ministryId, outsideMinistryId] } } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.account.delete({ where: { id: leaderId } });
    await prisma.person.deleteMany({ where: { id: { in: [...personIds, leaderPersonId] } } });
    await prisma.$disconnect();
  });

  it("persists an authorized visitor, attendance, timeline and audit", async () => {
    const fullName = `Visitante contextual ${suffix}`;
    const attendance = await registerContextualVisitor(actor(), meetingId, fullName);

    expect(attendance).toMatchObject({
      meetingId,
      status: "NOT_CONFIRMED",
      person: { fullName, status: "VISITOR" },
    });
    const person = await prisma.person.findUniqueOrThrow({ where: { id: attendance.personId } });
    expect(person).toMatchObject({ fullName, status: "VISITOR", phone: null, birthDate: null, profilePhotoUrl: null });
    await expect(prisma.attendance.count({ where: { meetingId, personId: person.id } })).resolves.toBe(1);
    await expect(prisma.timelineEvent.findFirst({ where: { personId: person.id } })).resolves.toMatchObject({
      category: "REGISTRATION",
      title: "Pessoa cadastrada",
      description: fullName,
      occurredAt: person.createdAt,
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: person.id, action: "CREATE" } })).resolves.toMatchObject({
      actorId: leaderId,
      targetType: "Person",
      after: expect.objectContaining({ id: person.id, fullName, status: "VISITOR" }),
    });
  });

  it("denies a meeting outside the granted Ministry before creating records", async () => {
    const fullName = `Visitante fora do escopo ${suffix}`;

    await expect(registerContextualVisitor(actor(), outsideMeetingId, fullName)).rejects.toThrow("Encontro não encontrado");
    await expect(prisma.person.findFirst({ where: { fullName } })).resolves.toBeNull();
    await expect(prisma.attendance.count({ where: { meetingId: outsideMeetingId } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { person: { fullName } } })).resolves.toBe(0);
    await expect(prisma.auditEvent.count({ where: { actorId: leaderId, targetType: "Person" } })).resolves.toBe(0);
  });

  it("denies a revoked or inactive Leader before creating records", async () => {
    const revokedName = `Visitante sem escopo ${suffix}`;
    await prisma.accountMinistryAccess.update({
      where: { accountId_ministryId: { accountId: leaderId, ministryId } },
      data: { revokedAt: new Date() },
    });
    await expect(registerContextualVisitor(actor(), meetingId, revokedName)).rejects.toThrow("Encontro não encontrado");
    await expect(prisma.person.findFirst({ where: { fullName: revokedName } })).resolves.toBeNull();

    await prisma.account.update({ where: { id: leaderId }, data: { status: "INACTIVE" } });
    const inactiveName = `Visitante conta inativa ${suffix}`;
    await expect(registerContextualVisitor(actor(), meetingId, inactiveName)).rejects.toThrow("Sessão inválida");
    await expect(prisma.person.findFirst({ where: { fullName: inactiveName } })).resolves.toBeNull();
    await expect(prisma.attendance.count({ where: { meetingId } })).resolves.toBe(0);
  });

  it("rejects an empty name and rolls back records when a later audit step fails", async () => {
    await expect(registerContextualVisitor(actor(), meetingId, "   ")).rejects.toThrow("Nome completo é obrigatório");

    const fullName = `Visitante rollback ${suffix}`;
    fault.failPersonAudit = true;
    try {
      await expect(registerContextualVisitor(actor(), meetingId, fullName)).rejects.toThrow("Injected audit failure");
    } finally {
      fault.failPersonAudit = false;
    }

    await expect(prisma.person.findFirst({ where: { fullName } })).resolves.toBeNull();
    await expect(prisma.attendance.count({ where: { meetingId } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { person: { fullName } } })).resolves.toBe(0);
    await expect(prisma.auditEvent.count({ where: { actorId: leaderId, targetType: "Person" } })).resolves.toBe(0);
  });
});
