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

export async function openAttendance(meetingId: string): Promise<Attendance[]> {
  return withTransaction(async (transaction) => {
    const meeting = await transaction.meeting.findUnique({
      where: { id: meetingId },
      include: { audiences: { select: { ministryId: true } } },
    });
    if (!meeting) throw new Error("Encontro não encontrado.");

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

export async function cycleAttendance(actor: MeetingActor, attendanceId: string, reason?: string) {
  return withTransaction(async (transaction) => {
    const attendance = await transaction.attendance.findUnique({
      where: { id: attendanceId },
      include: { meeting: { include: { audiences: true } }, person: true },
    });
    if (!attendance || !canManageMeeting(actor, attendance.meeting.audiences.map((audience) => audience.ministryId))) {
      throw new Error("Presença não encontrada.");
    }
    if (attendance.meeting.status === "CANCELLED") {
      throw new Error("Encontro cancelado não aceita lançamentos de presença.");
    }

    const nextStatus = nextAttendanceStatus(attendance.status);
    const updated = await transaction.attendance.update({ where: { id: attendanceId }, data: { status: nextStatus } });
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
      before: { status: attendance.status },
      after: { status: updated.status },
      reason: reason?.trim() || undefined,
    });
    return updated;
  });
}
