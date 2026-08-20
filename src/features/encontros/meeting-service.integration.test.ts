import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createMeeting, type MeetingActor } from "./meeting-service";

describe("meeting creation and audiences", () => {
  const suffix = Date.now().toString();
  let adminId: string;
  let leaderId: string;
  let categoryId: string;
  let allowedMinistryId: string;
  let otherMinistryId: string;
  const meetingIds: string[] = [];
  const personIds: string[] = [];
  const accountIds: string[] = [];

  const admin = (): MeetingActor => ({ id: adminId, role: "ADMINISTRATOR", ministryAccess: [] });
  const leader = (): MeetingActor => ({ id: leaderId, role: "LEADER", ministryAccess: [{ ministryId: allowedMinistryId, revokedAt: null }] });

  beforeAll(async () => {
    const adminPerson = await prisma.person.create({ data: { fullName: `Administrador T26 ${suffix}` } });
    const leaderPerson = await prisma.person.create({ data: { fullName: `Líder T26 ${suffix}` } });
    personIds.push(adminPerson.id, leaderPerson.id);
    const accounts = await Promise.all([
      prisma.account.create({ data: { personId: adminPerson.id, username: `admin-t26-${suffix}`, email: `admin-t26-${suffix}@example.test`, passwordHash: "test-hash", role: "ADMINISTRATOR" } }),
      prisma.account.create({ data: { personId: leaderPerson.id, username: `leader-t26-${suffix}`, email: `leader-t26-${suffix}@example.test`, passwordHash: "test-hash", role: "LEADER" } }),
    ]);
    adminId = accounts[0].id;
    leaderId = accounts[1].id;
    accountIds.push(...accounts.map((account) => account.id));
    const category = await prisma.category.create({ data: { name: `Categoria T26 ${suffix}` } });
    const ministries = await Promise.all([
      prisma.ministry.create({ data: { name: `Ministério T26 permitido ${suffix}` } }),
      prisma.ministry.create({ data: { name: `Ministério T26 outro ${suffix}` } }),
    ]);
    categoryId = category.id;
    allowedMinistryId = ministries[0].id;
    otherMinistryId = ministries[1].id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: accountIds } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: { in: meetingIds } } });
    await prisma.meeting.deleteMany({ where: { id: { in: meetingIds } } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.ministry.deleteMany({ where: { id: { in: [allowedMinistryId, otherMinistryId] } } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  });

  it("creates a whole-church meeting and a selected-ministry audience", async () => {
    const wholeChurch = await createMeeting(admin(), { categoryId, title: "Celebração T26", scheduledAt: new Date("2026-09-01T22:00:00.000Z"), wholeChurch: true, status: "SCHEDULED" });
    const selected = await createMeeting(admin(), { categoryId, title: "Equipe T26", scheduledAt: new Date("2026-09-02T22:00:00.000Z"), wholeChurch: false, ministryIds: [allowedMinistryId] });
    meetingIds.push(wholeChurch.id, selected.id);
    await expect(prisma.meetingAudience.findMany({ where: { meetingId: wholeChurch.id } })).resolves.toHaveLength(0);
    await expect(prisma.meetingAudience.findMany({ where: { meetingId: selected.id } })).resolves.toMatchObject([{ ministryId: allowedMinistryId }]);
  });

  it("limits leaders to granted ministries and keeps cancelled meetings queryable", async () => {
    const cancelled = await createMeeting(leader(), { categoryId, title: "Cancelado T26", scheduledAt: new Date("2026-09-03T22:00:00.000Z"), wholeChurch: false, ministryIds: [allowedMinistryId], status: "CANCELLED" });
    meetingIds.push(cancelled.id);
    expect(cancelled.status).toBe("CANCELLED");
    await expect(createMeeting(leader(), { categoryId, title: "Fora do escopo T26", scheduledAt: new Date("2026-09-04T22:00:00.000Z"), wholeChurch: false, ministryIds: [otherMinistryId] })).rejects.toThrow("escopo");
    await expect(prisma.meeting.findUnique({ where: { id: cancelled.id } })).resolves.toMatchObject({ status: "CANCELLED" });
  });
});
