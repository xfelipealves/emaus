import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { searchAttendancePeople, addPersonToAttendance, summarizeAttendance, addQuickVisitor } from "./attendance-query";

describe("attendance operation query", () => {
  const suffix = Date.now().toString();
  let accountId: string;
  let categoryId: string;
  let ministryId: string;
  let meetingId: string;
  let existingPersonId: string;
  let attendancePersonId: string;

  beforeAll(async () => {
    const account = await prisma.account.create({ data: { username: `t29-${suffix}`, email: `t29-${suffix}@example.test`, passwordHash: "test-hash", role: "ADMINISTRATOR", person: { create: { fullName: `Ator T29 ${suffix}` } } } });
    accountId = account.id;
    const category = await prisma.category.create({ data: { name: `Categoria T29 ${suffix}` } });
    categoryId = category.id;
    const ministry = await prisma.ministry.create({ data: { name: `Ministério T29 ${suffix}` } });
    ministryId = ministry.id;
    const meeting = await prisma.meeting.create({ data: { categoryId, title: `Encontro T29 ${suffix}`, scheduledAt: new Date("2026-08-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId } } } });
    meetingId = meeting.id;
    const existing = await prisma.person.create({ data: { fullName: `Pessoa Encontrada T29 ${suffix}` } });
    existingPersonId = existing.id;
    const alreadyAdded = await prisma.person.create({ data: { fullName: `Pessoa Presente T29 ${suffix}` } });
    attendancePersonId = alreadyAdded.id;
    await prisma.attendance.create({ data: { meetingId, personId: attendancePersonId, status: "PRESENT" } });
  });

  beforeEach(async () => {
    await prisma.attendance.deleteMany({ where: { meetingId, personId: { not: attendancePersonId } } });
    await prisma.person.update({ where: { id: attendancePersonId }, data: { fullName: `Pessoa Presente T29 ${suffix}` } });
    await prisma.attendance.update({ where: { meetingId_personId: { meetingId, personId: attendancePersonId } }, data: { status: "PRESENT" } });
  });

  afterAll(async () => {
    const people = await prisma.person.findMany({ where: { fullName: { contains: `T29 ${suffix}` } }, select: { id: true } });
    await prisma.attendance.deleteMany({ where: { meetingId } });
    await prisma.auditEvent.deleteMany({ where: { actorId: accountId } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: people.map((person) => person.id) } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId } });
    await prisma.meeting.delete({ where: { id: meetingId } });
    await prisma.ministry.delete({ where: { id: ministryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.account.delete({ where: { id: accountId } });
    await prisma.person.deleteMany({ where: { id: { in: people.map((person) => person.id) } } });
  });

  it("searches an active person and excludes people already in the board", async () => {
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };
    await expect(searchAttendancePeople(actor, meetingId, `encontrada t29 ${suffix}`)).resolves.toMatchObject([{ id: existingPersonId, fullName: `Pessoa Encontrada T29 ${suffix}`, status: "VISITOR" }]);
    await expect(searchAttendancePeople(actor, meetingId, `presente t29 ${suffix}`)).resolves.toEqual([]);
  });

  it("adds a searched person and starts the attendance at not confirmed", async () => {
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };
    const attendance = await addPersonToAttendance(actor, meetingId, existingPersonId);
    expect(attendance).toMatchObject({ meetingId, personId: existingPersonId, status: "NOT_CONFIRMED", person: { fullName: `Pessoa Encontrada T29 ${suffix}` } });
  });

  it("creates a quick visitor and adds them immediately", async () => {
    const actor = { id: accountId, role: "ADMINISTRATOR" as const, ministryAccess: [] };
    const attendance = await addQuickVisitor(actor, meetingId, `Visitante Rápido T29 ${suffix}`);
    expect(attendance).toMatchObject({ meetingId, status: "NOT_CONFIRMED", person: { fullName: `Visitante Rápido T29 ${suffix}`, status: "VISITOR" } });
  });

  it("summarizes each attendance state", () => {
    expect(summarizeAttendance([{ status: "NOT_CONFIRMED" }, { status: "PRESENT" }, { status: "PRESENT" }, { status: "ABSENT" }])).toEqual({ NOT_CONFIRMED: 1, PRESENT: 2, ABSENT: 1 });
  });
});
