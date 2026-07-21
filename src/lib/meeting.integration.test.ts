import {
  AttendanceStatus,
  MeetingAudienceType,
  MeetingRecurrence,
  MeetingStatus,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

describe("Meeting schema", () => {
  beforeEach(async () => {
    await prisma.attendance.deleteMany();
    await prisma.meetingAudience.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.meetingSeries.deleteMany();
    await prisma.category.deleteMany();
    await prisma.ministry.deleteMany();
    await prisma.person.deleteMany();
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany();
    await prisma.meetingAudience.deleteMany();
    await prisma.meeting.deleteMany();
    await prisma.meetingSeries.deleteMany();
    await prisma.category.deleteMany();
    await prisma.ministry.deleteMany();
    await prisma.person.deleteMany();
    await prisma.$disconnect();
  });

  it("stores recurrence interval, selected weekdays and optional end date", async () => {
    const category = await prisma.category.create({ data: { name: "Culto" } });
    const startDate = new Date("2026-01-04T00:00:00.000Z");
    const endDate = new Date("2026-12-27T00:00:00.000Z");

    const series = await prisma.meetingSeries.create({
      data: {
        name: "Culto dominical",
        categoryId: category.id,
        recurrence: MeetingRecurrence.WEEKLY,
        weekdays: [0],
        startDate,
        endDate,
      },
    });

    expect(series.recurrence).toBe(MeetingRecurrence.WEEKLY);
    expect(series.weekdays).toEqual([0]);
    expect(series.startDate).toEqual(startDate);
    expect(series.endDate).toEqual(endDate);
  });

  it("represents meeting status and both audience modes", async () => {
    const category = await prisma.category.create({ data: { name: "Encontro" } });
    const ministry = await prisma.ministry.create({ data: { name: "Música" } });
    const meeting = await prisma.meeting.create({
      data: {
        title: "Encontro de toda a igreja",
        categoryId: category.id,
        startsAt: new Date("2026-07-26T18:00:00.000Z"),
        status: MeetingStatus.SCHEDULED,
        audiences: {
          create: [
            { type: MeetingAudienceType.WHOLE_CHURCH },
            { type: MeetingAudienceType.MINISTRIES, ministryId: ministry.id },
          ],
        },
      },
      include: { audiences: true },
    });

    expect(meeting.status).toBe(MeetingStatus.SCHEDULED);
    expect(meeting.audiences.map(({ type }) => type)).toEqual([
      MeetingAudienceType.WHOLE_CHURCH,
      MeetingAudienceType.MINISTRIES,
    ]);
  });

  it("stores one attendance per person and supports the three states", async () => {
    const person = await prisma.person.create({ data: { fullName: "Participante" } });
    const category = await prisma.category.create({ data: { name: "Reunião" } });
    const meeting = await prisma.meeting.create({
      data: {
        title: "Reunião de teste",
        categoryId: category.id,
        startsAt: new Date("2026-07-27T19:00:00.000Z"),
        status: MeetingStatus.DRAFT,
      },
    });

    const attendance = await prisma.attendance.create({
      data: { meetingId: meeting.id, personId: person.id },
    });

    expect(attendance.status).toBe(AttendanceStatus.NOT_CONFIRMED);
    expect(Object.values(AttendanceStatus)).toEqual([
      AttendanceStatus.NOT_CONFIRMED,
      AttendanceStatus.PRESENT,
      AttendanceStatus.ABSENT,
    ]);
    await expect(
      prisma.attendance.create({ data: { meetingId: meeting.id, personId: person.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
