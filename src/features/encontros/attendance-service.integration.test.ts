import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { cycleAttendance, openAttendance } from "./attendance-service";

describe("attendance initialization", () => {
  const suffix = Date.now().toString();
  let categoryId: string;
  let meetingId: string;
  let ministryId: string;
  let accountId: string;
  const personIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({ data: { name: `Categoria T27 ${suffix}` } });
    categoryId = category.id;
    const ministry = await prisma.ministry.create({ data: { name: `Ministério T27 ${suffix}` } });
    ministryId = ministry.id;
    const account = await prisma.account.create({ data: { username: `t28-${suffix}`, email: `t28-${suffix}@example.test`, passwordHash: "test-hash", role: "ADMINISTRATOR", person: { create: { fullName: `Ator T28 ${suffix}` } } } });
    accountId = account.id;
    const people = await Promise.all([
      prisma.person.create({ data: { fullName: `Atual T27 ${suffix}` } }),
      prisma.person.create({ data: { fullName: `Fora T27 ${suffix}` } }),
      prisma.person.create({ data: { fullName: `Outra T27 ${suffix}` } }),
    ]);
    personIds.push(...people.map((person) => person.id));
    await prisma.ministryMembership.create({ data: { personId: people[0].id, ministryId, startDate: new Date("2026-01-01T00:00:00.000Z") } });
    await prisma.ministryMembership.create({ data: { personId: people[1].id, ministryId, startDate: new Date("2027-01-01T00:00:00.000Z") } });
    await prisma.ministryMembership.create({ data: { personId: people[2].id, ministryId, startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-02-01T00:00:00.000Z") } });
    const meeting = await prisma.meeting.create({ data: { categoryId, title: `Ministério T27 ${suffix}`, scheduledAt: new Date("2026-08-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId } } } });
    meetingId = meeting.id;
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { meetingId } });
    await prisma.auditEvent.deleteMany({ where: { actorId: accountId } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId } });
    await prisma.meeting.delete({ where: { id: meetingId } });
    await prisma.ministry.delete({ where: { id: ministryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.account.delete({ where: { id: accountId } });
  });

  beforeEach(async () => {
    await prisma.attendance.deleteMany({ where: { meetingId } });
    await prisma.auditEvent.deleteMany({ where: { actorId: accountId } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
  });

  it("cycles attendance and records correction audit and timeline", async () => {
    const [attendance] = await openAttendance(meetingId);
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };
    const present = await cycleAttendance(actor, attendance.id);
    expect(present.status).toBe("PRESENT");
    const absent = await cycleAttendance(actor, attendance.id, "Correção após conferência");
    expect(absent.status).toBe("ABSENT");
    await expect(prisma.auditEvent.findFirst({ where: { targetId: attendance.id, action: "UPDATE", reason: "Correção após conferência" } })).resolves.toMatchObject({ actorId: accountId, before: { status: "PRESENT" }, after: { status: "ABSENT" }, reason: "Correção após conferência" });
    await expect(prisma.timelineEvent.findFirst({ where: { personId: personIds[0], category: "ATTENDANCE" } })).resolves.toMatchObject({ title: "Presença atualizada" });
  });

  it("rejects attendance changes for a cancelled meeting", async () => {
    const [attendance] = await openAttendance(meetingId);
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED" } });
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };
    await expect(cycleAttendance(actor, attendance.id)).rejects.toThrow("Encontro cancelado não aceita lançamentos de presença.");
    await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "SCHEDULED" } });
  });

  it("does not initialize attendance for a cancelled meeting", async () => {
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED" } });
    await expect(openAttendance(meetingId)).rejects.toThrow("Encontro cancelado não aceita lançamentos de presença.");
    await expect(prisma.attendance.count({ where: { meetingId } })).resolves.toBe(0);
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "SCHEDULED" } });
  });

  it("rejects a first attendance launch after the audience ministry is archived", async () => {
    const [attendance] = await openAttendance(meetingId);
    await prisma.ministry.update({ where: { id: ministryId }, data: { status: "ARCHIVED" } });
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };

    await expect(cycleAttendance(actor, attendance.id)).rejects.toThrow("Ministério arquivado não aceita novos lançamentos de presença.");
    await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });
    await prisma.ministry.update({ where: { id: ministryId }, data: { status: "ACTIVE" } });
  });

  it("initializes selected-ministry eligibility and is idempotent when reopened", async () => {
    const first = await openAttendance(meetingId);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ personId: personIds[0], meetingId, status: "NOT_CONFIRMED" });

    await prisma.attendance.update({ where: { meetingId_personId: { meetingId, personId: personIds[0] } }, data: { status: "PRESENT" } });
    const reopened = await openAttendance(meetingId);
    expect(reopened).toHaveLength(1);
    expect(reopened[0].status).toBe("PRESENT");
    await expect(prisma.attendance.count({ where: { meetingId } })).resolves.toBe(1);
  });

});
