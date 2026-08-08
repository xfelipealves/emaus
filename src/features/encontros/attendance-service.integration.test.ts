import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { openAttendance } from "./attendance-service";

describe("attendance initialization", () => {
  const suffix = Date.now().toString();
  let categoryId: string;
  let meetingId: string;
  let wholeChurchMeetingId: string;
  let ministryId: string;
  const personIds: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({ data: { name: `Categoria T27 ${suffix}` } });
    categoryId = category.id;
    const ministry = await prisma.ministry.create({ data: { name: `Ministério T27 ${suffix}` } });
    ministryId = ministry.id;
    const people = await Promise.all([
      prisma.person.create({ data: { fullName: `Atual T27 ${suffix}` } }),
      prisma.person.create({ data: { fullName: `Fora T27 ${suffix}` } }),
      prisma.person.create({ data: { fullName: `Outra T27 ${suffix}` } }),
    ]);
    personIds.push(...people.map((person) => person.id));
    await prisma.ministryMembership.create({ data: { personId: people[0].id, ministryId, startDate: new Date("2026-01-01T00:00:00.000Z") } });
    await prisma.ministryMembership.create({ data: { personId: people[1].id, ministryId, startDate: new Date("2027-01-01T00:00:00.000Z") } });
    await prisma.ministryMembership.create({ data: { personId: people[2].id, ministryId, startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-02-01T00:00:00.000Z") } });
    const meetings = await Promise.all([
      prisma.meeting.create({ data: { categoryId, title: `Ministério T27 ${suffix}`, scheduledAt: new Date("2026-08-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId } } } }),
      prisma.meeting.create({ data: { categoryId, title: `Igreja T27 ${suffix}`, scheduledAt: new Date("2026-08-11T22:00:00.000Z"), status: "SCHEDULED" } }),
    ]);
    meetingId = meetings[0].id;
    wholeChurchMeetingId = meetings[1].id;
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { meetingId: { in: [meetingId, wholeChurchMeetingId] } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: { in: [meetingId, wholeChurchMeetingId] } } });
    await prisma.meeting.deleteMany({ where: { id: { in: [meetingId, wholeChurchMeetingId] } } });
    await prisma.ministry.delete({ where: { id: ministryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
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

  it("initializes every person with a current ministry membership for whole-church meetings", async () => {
    const attendances = await openAttendance(wholeChurchMeetingId);
    expect(attendances.map((attendance) => attendance.personId)).toEqual([personIds[0]]);
    await expect(prisma.attendance.count({ where: { meetingId: wholeChurchMeetingId } })).resolves.toBe(1);
  });
});
