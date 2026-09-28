import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { inactivatePerson, promoteToMember } from "./status-service";

describe("Person status service", () => {
  const personIds: string[] = [];
  const ministryIds: string[] = [];
  const categoryIds: string[] = [];
  const meetingIds: string[] = [];
  const noteIds: string[] = [];
  const actorId = "t18-status-actor";
  const actor = { id: actorId, role: "SECRETARY" as const };
  const effectiveDate = new Date("2026-07-15T12:00:00.000Z");

  beforeAll(async () => {
    const actorPerson = await prisma.person.create({ data: { fullName: "Autor T18" } });
    personIds.push(actorPerson.id);
    await prisma.account.create({
      data: {
        id: actorId,
        personId: actorPerson.id,
        username: "t18-status-actor",
        email: "t18-status-actor@example.test",
        passwordHash: "test-hash",
        role: actor.role,
      },
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: personIds } } });
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: noteIds } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.noteVersion.deleteMany({ where: { note: { personId: { in: personIds } } } });
    await prisma.note.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.attendance.deleteMany({ where: { meetingId: { in: meetingIds } } });
    await prisma.meeting.deleteMany({ where: { id: { in: meetingIds } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: ministryIds } } });
    await prisma.account.delete({ where: { id: actorId } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("promotes a visitor with required member data and an editable effective date", async () => {
    const visitor = await prisma.person.create({ data: { fullName: "Visitante T18" } });
    personIds.push(visitor.id);

    const member = await promoteToMember(actor, visitor.id, {
      phone: "  (11) 99999-1818  ",
      birthDate: new Date("1995-04-12T00:00:00.000Z"),
      effectiveDate,
    });

    expect(member.status).toBe("MEMBER");
    expect(member.phone).toBe("(11) 99999-1818");
    expect(member.birthDate).toEqual(new Date("1995-04-12T00:00:00.000Z"));
    expect(member.statusChangedAt).toEqual(effectiveDate);
    await expect(prisma.timelineEvent.findFirst({ where: { personId: visitor.id, category: "STATUS" } })).resolves.toMatchObject({
      title: "Pessoa promovida a membro",
      occurredAt: effectiveDate,
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: visitor.id, action: "PROMOTE_TO_MEMBER" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ status: "VISITOR" }),
      after: expect.objectContaining({ status: "MEMBER", phone: "(11) 99999-1818" }),
    });
  });

  it("blocks promotion without phone or birth date", async () => {
    const originalBirthDate = new Date("1988-03-12T00:00:00.000Z");
    const visitor = await prisma.person.create({
      data: {
        fullName: "Visitante incompleto T18",
        phone: "Telefone anterior",
        birthDate: originalBirthDate,
      },
    });
    personIds.push(visitor.id);
    await prisma.timelineEvent.create({
      data: {
        personId: visitor.id,
        category: "REGISTRATION",
        title: "Pessoa cadastrada",
        occurredAt: visitor.createdAt,
      },
    });

    await expect(
      promoteToMember(actor, visitor.id, {
        phone: "",
        birthDate: new Date("1995-04-12T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Telefone é obrigatório");
    await expect(
      promoteToMember(actor, visitor.id, {
        phone: "(11) 99999-0000",
        birthDate: undefined as never,
      }),
    ).rejects.toThrow("Data de nascimento é obrigatória");

    await expect(prisma.person.findUnique({ where: { id: visitor.id } })).resolves.toMatchObject({
      status: "VISITOR",
      phone: "Telefone anterior",
      birthDate: originalBirthDate,
      statusChangedAt: visitor.statusChangedAt,
    });
    await expect(prisma.timelineEvent.findMany({ where: { personId: visitor.id }, select: { title: true } })).resolves.toEqual([
      { title: "Pessoa cadastrada" },
    ]);
  });

  it("rolls back status and timeline when audit persistence fails", async () => {
    const visitor = await prisma.person.create({ data: { fullName: "Visitante rollback T18" } });
    personIds.push(visitor.id);
    await prisma.timelineEvent.create({
      data: {
        personId: visitor.id,
        category: "REGISTRATION",
        title: "Pessoa cadastrada",
        occurredAt: visitor.createdAt,
      },
    });

    await expect(
      promoteToMember({ id: "t18-missing-audit-actor", role: "SECRETARY" }, visitor.id, {
        phone: "(11) 99999-1818",
        birthDate: new Date("1995-04-12T00:00:00.000Z"),
        effectiveDate,
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(prisma.person.findUnique({ where: { id: visitor.id } })).resolves.toMatchObject({
      status: "VISITOR",
      phone: null,
      birthDate: null,
      statusChangedAt: visitor.statusChangedAt,
    });
    await expect(prisma.timelineEvent.findMany({ where: { personId: visitor.id }, select: { title: true } })).resolves.toEqual([
      { title: "Pessoa cadastrada" },
    ]);
    await expect(prisma.auditEvent.count({ where: { targetId: visitor.id } })).resolves.toBe(0);
  });

  it("inactivates a person without deleting the profile or history", async () => {
    const ministry = await prisma.ministry.create({ data: { name: "Ministério inativação T18" } });
    ministryIds.push(ministry.id);
    const category = await prisma.category.create({ data: { name: "Categoria inativação T18" } });
    categoryIds.push(category.id);
    const person = await prisma.person.create({
      data: {
        fullName: "Membro inativado T18",
        status: "MEMBER",
        memberships: { create: { ministryId: ministry.id, role: "MEMBER", startDate: effectiveDate } },
      },
    });
    personIds.push(person.id);
    const meeting = await prisma.meeting.create({
      data: {
        categoryId: category.id,
        title: "Encontro preservado T18",
        scheduledAt: effectiveDate,
        status: "SCHEDULED",
        attendances: { create: { personId: person.id, status: "PRESENT" } },
      },
    });
    meetingIds.push(meeting.id);
    const note = await prisma.note.create({
      data: {
        personId: person.id,
        authorId: actorId,
        content: "Nota preservada T18",
        versions: { create: { authorId: actorId, content: "Nota preservada T18", sequence: 1 } },
      },
    });
    noteIds.push(note.id);
    await prisma.timelineEvent.create({
      data: {
        personId: person.id,
        category: "REGISTRATION",
        title: "Pessoa cadastrada",
        occurredAt: person.createdAt,
      },
    });
    await prisma.timelineEvent.create({
      data: {
        personId: person.id,
        category: "NOTE",
        title: "Nota adicionada",
        description: note.content,
      },
    });

    const inactive = await inactivatePerson(actor, person.id, { effectiveDate });

    expect(inactive.id).toBe(person.id);
    expect(inactive.status).toBe("INACTIVE");
    expect(inactive.statusChangedAt).toEqual(effectiveDate);
    await expect(prisma.person.findUnique({ where: { id: person.id }, include: { memberships: true, attendances: true } })).resolves.toMatchObject({
      id: person.id,
      status: "INACTIVE",
      statusChangedAt: effectiveDate,
      memberships: [{ ministryId: ministry.id }],
      attendances: [{ meetingId: meeting.id, status: "PRESENT" }],
    });
    await expect(prisma.timelineEvent.findMany({ where: { personId: person.id }, orderBy: { createdAt: "asc" }, select: { title: true } })).resolves.toEqual([
      { title: "Pessoa cadastrada" },
      { title: "Nota adicionada" },
      { title: "Pessoa inativada" },
    ]);
    await expect(prisma.note.findUnique({ where: { id: note.id }, include: { versions: true } })).resolves.toMatchObject({
      id: note.id,
      personId: person.id,
      authorId: actorId,
      content: "Nota preservada T18",
      archived: false,
      versions: [{ authorId: actorId, content: "Nota preservada T18", sequence: 1 }],
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: person.id, action: "INACTIVATE" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ status: "MEMBER" }),
      after: expect.objectContaining({ status: "INACTIVE" }),
    });
  });
});
