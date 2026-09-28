import type { Attendance, AttendanceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canManageMeeting } from "../../server/authorization";
import { recordAuditEvent, recordTimelineEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";
import type { MeetingActor } from "./meeting-service";

export type EligibilityMembership = {
  personId: string;
  ministryId: string;
};

export type CycleAttendanceResult = {
  status: AttendanceStatus;
  changed: boolean;
};

export function projectEligiblePersonIds(
  memberships: readonly EligibilityMembership[],
  audienceMinistryIds: readonly string[],
): string[] {
  const audience = new Set(audienceMinistryIds);
  return [...new Set(
    memberships
      .filter((membership) => audience.size === 0 || audience.has(membership.ministryId))
      .map((membership) => membership.personId),
  )];
}

export function nextAttendanceStatus(status: AttendanceStatus): AttendanceStatus {
  if (status === "NOT_CONFIRMED") return "PRESENT";
  if (status === "PRESENT") return "ABSENT";
  return "NOT_CONFIRMED";
}

function currentMembershipWhere(today: Date) {
  return {
    startDate: { lte: today },
    OR: [{ endDate: null }, { endDate: { gte: today } }],
    ministry: { status: "ACTIVE" as const },
  };
}

type AttendanceMeetingBoundary = {
  status: string;
  audiences: Array<{ ministry: { status: string } }>;
};

function hasArchivedAudience(meeting: AttendanceMeetingBoundary) {
  return meeting.audiences.some((audience) => audience.ministry.status === "ARCHIVED");
}

function assertMeetingCanOpenAttendance(meeting: AttendanceMeetingBoundary) {
  if (meeting.status === "CANCELLED") {
    throw new Error("Encontro cancelado não aceita lançamentos de presença.");
  }
}

export async function openAttendance(meetingId: string): Promise<Attendance[]> {
  return withTransaction(async (transaction) => {
    const meeting = await transaction.meeting.findUnique({
      where: { id: meetingId },
      include: { audiences: { select: { ministryId: true, ministry: { select: { status: true } } } } },
    });
    if (!meeting) throw new Error("Encontro não encontrado.");
    assertMeetingCanOpenAttendance(meeting);

    if (hasArchivedAudience(meeting)) {
      const historicalAttendance = await transaction.attendance.findMany({
        where: { meetingId },
        include: { person: true },
        orderBy: { person: { fullName: "asc" } },
      });
      if (historicalAttendance.length === 0) {
        throw new Error("Ministério arquivado não aceita novos lançamentos de presença.");
      }
      return historicalAttendance;
    }

    const memberships = await transaction.ministryMembership.findMany({
      where: currentMembershipWhere(new Date()),
      select: { personId: true, ministryId: true },
    });
    const eligiblePersonIds = projectEligiblePersonIds(
      memberships,
      meeting.audiences.map((audience) => audience.ministryId),
    );

    if (eligiblePersonIds.length > 0) {
      await transaction.attendance.createMany({
        data: eligiblePersonIds.map((personId) => ({ meetingId, personId, status: "NOT_CONFIRMED" as AttendanceStatus })),
        skipDuplicates: true,
      });
    }

    return transaction.attendance.findMany({
      where: { meetingId, personId: { in: eligiblePersonIds } },
      include: { person: true },
      orderBy: { person: { fullName: "asc" } },
    });
  });
}

export async function getAttendanceBoard(actor: MeetingActor, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      audiences: true,
      attendances: { include: { person: true }, orderBy: { person: { fullName: "asc" } } },
    },
  });
  if (!meeting || !canManageMeeting(actor, meeting.audiences.map((audience) => audience.ministryId))) {
    throw new Error("Encontro não encontrado.");
  }
  return meeting;
}

export async function cycleAttendance(
  actor: MeetingActor,
  attendanceId: string,
  expectedStatus: AttendanceStatus,
  reason?: string,
): Promise<CycleAttendanceResult> {
  return withTransaction(async (transaction) => {
    const attendance = await transaction.attendance.findUnique({
      where: { id: attendanceId },
      include: { meeting: { include: { audiences: { include: { ministry: { select: { status: true } } } } } }, person: true },
    });
    if (!attendance || !canManageMeeting(actor, attendance.meeting.audiences.map((audience) => audience.ministryId))) {
      throw new Error("Presença não encontrada.");
    }
    if (attendance.meeting.status === "CANCELLED") {
      throw new Error("Encontro cancelado não aceita lançamentos de presença.");
    }
    if (attendance.status === "NOT_CONFIRMED" && hasArchivedAudience(attendance.meeting)) {
      throw new Error("Ministério arquivado não aceita novos lançamentos de presença.");
    }
    if (attendance.status !== expectedStatus) {
      return { status: attendance.status, changed: false };
    }

    const nextStatus = nextAttendanceStatus(attendance.status);
    const updateResult = await transaction.attendance.updateMany({
      where: { id: attendanceId, status: expectedStatus },
      data: { status: nextStatus },
    });
    if (updateResult.count === 0) {
      const current = await transaction.attendance.findUnique({
        where: { id: attendanceId },
        select: { status: true },
      });
      if (!current) throw new Error("Presença não encontrada.");
      return { status: current.status, changed: false };
    }

    await recordTimelineEvent(transaction, {
      personId: attendance.personId,
      category: "ATTENDANCE",
      title: "Presença atualizada",
      description: `${attendance.meeting.title}: ${attendance.status} → ${nextStatus}`,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Attendance",
      targetId: attendance.id,
      action: "UPDATE",
      before: { status: expectedStatus },
      after: { status: nextStatus },
      reason: reason?.trim() || undefined,
    });
    return { status: nextStatus, changed: true };
  });
}
