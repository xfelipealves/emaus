import type { Attendance, AttendanceStatus } from "@prisma/client";
import { withTransaction } from "../../server/transaction";

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
