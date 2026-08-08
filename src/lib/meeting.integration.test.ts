import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

describe("Meeting persistence", () => {
  let categoryId: string;
  let seriesId: string;
  let meetingId: string;
  let ministryId: string;
  let personId: string;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { name: "Categoria de integração T08" },
    });
    categoryId = category.id;

    const series = await prisma.meetingSeries.create({
      data: {
        categoryId,
        name: "Série de integração T08",
        recurrence: "BIWEEKLY",
        weekdays: [2, 4],
        startDate: new Date("2026-01-05T00:00:00.000Z"),
      },
    });
    seriesId = series.id;

    const meeting = await prisma.meeting.create({
      data: {
        categoryId,
        seriesId,
        title: "Encontro de integração T08",
        scheduledAt: new Date("2026-01-07T19:00:00.000Z"),
        status: "SCHEDULED",
      },
    });
    meetingId = meeting.id;

    const ministry = await prisma.ministry.create({
      data: { name: "Ministério de integração T08" },
    });
    ministryId = ministry.id;

    const person = await prisma.person.create({
      data: { fullName: "Pessoa de integração T08" },
    });
    personId = person.id;
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { meetingId } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId } });
    await prisma.meeting.deleteMany({ where: { id: meetingId } });
    await prisma.meetingSeries.deleteMany({ where: { id: seriesId } });
    await prisma.ministry.deleteMany({ where: { id: ministryId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.person.deleteMany({ where: { id: personId } });
    await prisma.$disconnect();
  });

  it("supports recurrence patterns, selected weekdays and an optional end date", async () => {
    const series = await prisma.meetingSeries.findUniqueOrThrow({
      where: { id: seriesId },
    });

    expect(series.recurrence).toBe("BIWEEKLY");
    expect(series.weekdays).toEqual([2, 4]);
    expect(series.endDate).toBeNull();
  });

  it("keeps occurrence status independently editable and stores selected audience", async () => {
    const cancelled = await prisma.meeting.create({
      data: {
        categoryId,
        seriesId,
        title: "Ocorrência cancelada T08",
        scheduledAt: new Date("2026-01-21T19:00:00.000Z"),
        status: "CANCELLED",
        audiences: { create: { ministryId } },
      },
      include: { audiences: true },
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.audiences).toHaveLength(1);
    expect(cancelled.audiences[0].ministryId).toBe(ministryId);
    expect(cancelled.id).not.toBe(meetingId);

    await prisma.meetingAudience.deleteMany({ where: { meetingId: cancelled.id } });
    await prisma.meeting.delete({ where: { id: cancelled.id } });
  });

  it("stores one attendance per meeting and supports the three attendance states", async () => {
    const attendance = await prisma.attendance.create({
      data: { meetingId, personId },
    });

    expect(attendance.status).toBe("NOT_CONFIRMED");

    const present = await prisma.attendance.update({
      where: { meetingId_personId: { meetingId, personId } },
      data: { status: "PRESENT" },
    });
    expect(present.status).toBe("PRESENT");

    const absent = await prisma.attendance.update({
      where: { meetingId_personId: { meetingId, personId } },
      data: { status: "ABSENT" },
    });
    expect(absent.status).toBe("ABSENT");
  });
});
