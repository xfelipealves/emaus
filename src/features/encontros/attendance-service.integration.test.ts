import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { cycleAttendance, getAttendanceBoard, openAttendance } from "./attendance-service";

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
    const present = await cycleAttendance(actor, attendance.id, "NOT_CONFIRMED");
    expect(present).toEqual({ status: "PRESENT", changed: true });
    const absent = await cycleAttendance(actor, attendance.id, present.status, "Correção após conferência");
    expect(absent).toEqual({ status: "ABSENT", changed: true });
    const notConfirmed = await cycleAttendance(actor, attendance.id, absent.status);
    expect(notConfirmed).toEqual({ status: "NOT_CONFIRMED", changed: true });

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { targetType: "Attendance", targetId: attendance.id, action: "UPDATE", reason: "Correção após conferência" } });
    expect(audit).toMatchObject({ actorId: accountId, targetType: "Attendance", targetId: attendance.id, action: "UPDATE", before: { status: "PRESENT" }, after: { status: "ABSENT" }, reason: "Correção após conferência" });
    expect(audit.createdAt).toBeInstanceOf(Date);
    const optionalReasonAudit = (await prisma.auditEvent.findMany({ where: { targetType: "Attendance", targetId: attendance.id, action: "UPDATE", reason: null } })).find(({ before, after }) => JSON.stringify(before) === JSON.stringify({ status: "NOT_CONFIRMED" }) && JSON.stringify(after) === JSON.stringify({ status: "PRESENT" }));
    expect(optionalReasonAudit).toMatchObject({ actorId: accountId, before: { status: "NOT_CONFIRMED" }, after: { status: "PRESENT" }, reason: null });
    const timeline = await prisma.timelineEvent.findFirstOrThrow({ where: { personId: personIds[0], category: "ATTENDANCE", description: { contains: "PRESENT → ABSENT" } } });
    expect(timeline).toMatchObject({ personId: personIds[0], title: "Presença atualizada", description: `Ministério T27 ${suffix}: PRESENT → ABSENT` });
  });

  it("does not apply or record a second transition when a retry carries an old expected state", async () => {
    const [attendance] = await openAttendance(meetingId);
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };

    await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).resolves.toEqual({ status: "PRESENT", changed: true });
    await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).resolves.toEqual({ status: "PRESENT", changed: false });
    await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "PRESENT" });
    await expect(prisma.auditEvent.count({ where: { targetType: "Attendance", targetId: attendance.id } })).resolves.toBe(1);
    await expect(prisma.timelineEvent.count({ where: { personId: attendance.personId, category: "ATTENDANCE" } })).resolves.toBe(1);
  });

  it("applies only one transition for simultaneous requests with the same expected state", async () => {
    const [attendance] = await openAttendance(meetingId);
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };

    const results = await Promise.all([
      cycleAttendance(actor, attendance.id, "NOT_CONFIRMED"),
      cycleAttendance(actor, attendance.id, "NOT_CONFIRMED"),
    ]);

    expect(results.map(({ status }) => status)).toEqual(["PRESENT", "PRESENT"]);
    expect(results.filter(({ changed }) => changed)).toHaveLength(1);
    expect(results.filter(({ changed }) => !changed)).toHaveLength(1);
    await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "PRESENT" });
    await expect(prisma.auditEvent.count({ where: { targetId: attendance.id, targetType: "Attendance" } })).resolves.toBe(1);
    await expect(prisma.timelineEvent.count({ where: { personId: attendance.personId, category: "ATTENDANCE" } })).resolves.toBe(1);
  });

  it("rolls back attendance and timeline when audit persistence fails", async () => {
    const [attendance] = await openAttendance(meetingId);
    const failedActor = await prisma.account.create({ data: { username: `deleted-audit-actor-${suffix}`, email: `deleted-audit-actor-${suffix}@example.test`, passwordHash: "test-hash", role: "ADMINISTRATOR", person: { create: { fullName: `Deleted audit actor ${suffix}` } } } });
    await prisma.account.delete({ where: { id: failedActor.id } });

    try {
      await expect(cycleAttendance({ id: failedActor.id, role: "ADMINISTRATOR", ministryAccess: [] }, attendance.id, "NOT_CONFIRMED")).rejects.toThrow();
      await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });
      await expect(prisma.auditEvent.count({ where: { targetId: attendance.id } })).resolves.toBe(0);
      await expect(prisma.timelineEvent.count({ where: { personId: attendance.personId, category: "ATTENDANCE" } })).resolves.toBe(0);
    } finally {
      await prisma.person.deleteMany({ where: { id: failedActor.personId } });
    }
  });

  it("denies listing and cycling attendance outside the meeting scope", async () => {
    const [attendance] = await openAttendance(meetingId);
    const outOfScopeLeader = { id: accountId, role: "LEADER" as const, ministryAccess: [] };

    await expect(getAttendanceBoard(outOfScopeLeader, meetingId)).rejects.toThrow("Encontro não encontrado.");
    await expect(cycleAttendance(outOfScopeLeader, attendance.id, "NOT_CONFIRMED")).rejects.toThrow("Presença não encontrada.");
    await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });
  });

  it("rejects attendance changes for a cancelled meeting", async () => {
    const [attendance] = await openAttendance(meetingId);
    await prisma.meeting.update({ where: { id: meetingId }, data: { status: "CANCELLED" } });
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };
    await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).rejects.toThrow("Encontro cancelado não aceita lançamentos de presença.");
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

    await expect(cycleAttendance(actor, attendance.id, "NOT_CONFIRMED")).rejects.toThrow("Ministério arquivado não aceita novos lançamentos de presença.");
    await expect(prisma.attendance.findUnique({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });
    await prisma.ministry.update({ where: { id: ministryId }, data: { status: "ACTIVE" } });
  });

  it("keeps historical attendance available after the audience ministry is archived", async () => {
    const [attendance] = await openAttendance(meetingId);
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };
    await cycleAttendance(actor, attendance.id, "NOT_CONFIRMED");
    await prisma.ministry.update({ where: { id: ministryId }, data: { status: "ARCHIVED" } });

    try {
      await expect(openAttendance(meetingId)).resolves.toMatchObject([{ id: attendance.id, status: "PRESENT" }]);
      await expect(cycleAttendance(actor, attendance.id, "PRESENT", "Correção histórica após arquivamento")).resolves.toEqual({ status: "ABSENT", changed: true });
      await expect(prisma.attendance.count({ where: { meetingId } })).resolves.toBe(1);
    } finally {
      await prisma.ministry.update({ where: { id: ministryId }, data: { status: "ACTIVE" } });
    }
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
