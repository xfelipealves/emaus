import type { AttendanceStatus, MeetingStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { normalizeDateOnly, parseDateInput, parseDateTimeInput } from "../../lib/dates";
import { listMinistries, type MinistryActor } from "./ministry-service";

export type FrequencyReportPeriodResult =
  | { kind: "incomplete" }
  | { kind: "invalid"; message: string }
  | { kind: "valid"; start: Date; endExclusive: Date };

export type FrequencyMinistry = { id: string; name: string };

export type FrequencyMeeting = {
  scheduledAt: Date;
  status: MeetingStatus;
  audiences: Array<{ ministryId: string }>;
  attendances: Array<{ personId: string; status: AttendanceStatus }>;
};

export type FrequencyMembership = {
  personId: string;
  ministryId: string;
  startDate: Date;
  endDate: Date | null;
};

export type MinistryFrequencySummary = {
  ministryId: string;
  ministryName: string;
  totals: Record<AttendanceStatus, number>;
};

function nextDate(value: string) {
  const date = parseDateInput(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function parseFrequencyReportPeriod(from: string, to: string): FrequencyReportPeriodResult {
  if (!from || !to) return { kind: "incomplete" };

  let fromDate: Date;
  let toDate: Date;
  try {
    fromDate = parseDateInput(from);
    toDate = parseDateInput(to);
  } catch {
    return { kind: "invalid", message: "Data inválida." };
  }

  if (fromDate > toDate) {
    return { kind: "invalid", message: "A data final deve ser igual ou posterior à data inicial." };
  }

  try {
    return {
      kind: "valid",
      start: parseDateTimeInput(`${from}T00:00`),
      endExclusive: parseDateTimeInput(`${nextDate(to)}T00:00`),
    };
  } catch {
    return { kind: "invalid", message: "Data inválida." };
  }
}

function meetingCalendarDate(meetingDate: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(meetingDate);
  const fields = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(fields.year, fields.month - 1, fields.day));
}

function isMembershipValidOnDate(membership: FrequencyMembership, date: Date) {
  const day = normalizeDateOnly(date).getTime();
  const start = normalizeDateOnly(membership.startDate).getTime();
  const end = membership.endDate ? normalizeDateOnly(membership.endDate).getTime() : Number.POSITIVE_INFINITY;
  return start <= day && day <= end;
}

function emptyTotals(): Record<AttendanceStatus, number> {
  return { NOT_CONFIRMED: 0, PRESENT: 0, ABSENT: 0 };
}

export function summarizeMinistryFrequency(
  ministries: readonly FrequencyMinistry[],
  meetings: readonly FrequencyMeeting[],
  memberships: readonly FrequencyMembership[],
): MinistryFrequencySummary[] {
  const summaries = new Map(ministries.map((ministry) => [ministry.id, {
    ministryId: ministry.id,
    ministryName: ministry.name,
    totals: emptyTotals(),
  }]));

  for (const meeting of meetings) {
    if (meeting.status === "CANCELLED") continue;

    if (meeting.audiences.length > 0) {
      for (const audience of meeting.audiences) {
        const summary = summaries.get(audience.ministryId);
        if (!summary) continue;
        for (const attendance of meeting.attendances) {
          summary.totals[attendance.status] += 1;
        }
      }
      continue;
    }

    const meetingDate = meetingCalendarDate(meeting.scheduledAt);
    for (const attendance of meeting.attendances) {
      for (const ministry of ministries) {
        const summary = summaries.get(ministry.id)!;
        const validMembership = memberships.some((membership) =>
          membership.personId === attendance.personId
          && membership.ministryId === ministry.id
          && isMembershipValidOnDate(membership, meetingDate),
        );
        if (validMembership) summary.totals[attendance.status] += 1;
      }
    }
  }

  return [...summaries.values()];
}

export async function getMinistryFrequencyReport(
  actor: MinistryActor,
  period: { start: Date; endExclusive: Date },
) {
  const ministries = await listMinistries(actor);
  if (ministries.length === 0) return [];

  const meetings = await prisma.meeting.findMany({
    where: {
      scheduledAt: { gte: period.start, lt: period.endExclusive },
      status: { not: "CANCELLED" },
    },
    select: {
      scheduledAt: true,
      status: true,
      audiences: { select: { ministryId: true } },
      attendances: { select: { personId: true, status: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const globalAttendeeIds = [...new Set(meetings
    .filter((meeting) => meeting.audiences.length === 0)
    .flatMap((meeting) => meeting.attendances.map((attendance) => attendance.personId)))];

  const memberships = globalAttendeeIds.length === 0
    ? []
    : await prisma.ministryMembership.findMany({
      where: {
        ministryId: { in: ministries.map((ministry) => ministry.id) },
        personId: { in: globalAttendeeIds },
      },
      select: { personId: true, ministryId: true, startDate: true, endDate: true },
    });

  return summarizeMinistryFrequency(ministries, meetings, memberships);
}
