import type { AttendanceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canManageMeeting } from "../../server/authorization";
import { withTransaction } from "../../server/transaction";
import type { MeetingActor } from "./meeting-service";
import { registerContextualVisitor } from "./quick-visitor-service";

export type AttendanceSearchItem = {
  id: string;
  fullName: string;
  status: "VISITOR" | "MEMBER";
};

function assertMeetingAccess(
  actor: MeetingActor,
  meeting: { audiences: Array<{ ministryId: string; ministry: { status: string } }>; status: string } | null,
) {
  if (!meeting || !canManageMeeting(actor, meeting.audiences.map((audience) => audience.ministryId))) {
    throw new Error("Encontro não encontrado.");
  }
  if (meeting.status === "CANCELLED") throw new Error("Encontro cancelado não aceita lançamentos de presença.");
  if (meeting.audiences.some((audience) => audience.ministry.status === "ARCHIVED")) {
    throw new Error("Ministério arquivado não aceita novos lançamentos de presença.");
  }
}

async function getMeetingForQuery(meetingId: string) {
  return prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { audiences: { include: { ministry: { select: { status: true } } } } },
  });
}

export async function searchAttendancePeople(actor: MeetingActor, meetingId: string, search: string): Promise<AttendanceSearchItem[]> {
  const meeting = await getMeetingForQuery(meetingId);
  assertMeetingAccess(actor, meeting);
  const term = search.trim();
  if (!term) return [];

  const people = await prisma.person.findMany({
    where: {
      status: { in: ["VISITOR", "MEMBER"] },
      fullName: { contains: term, mode: "insensitive" },
      attendances: { none: { meetingId } },
      ...(actor.role === "LEADER"
        ? { memberships: { some: { ministryId: { in: actor.ministryAccess.filter((access) => access.revokedAt === null).map((access) => access.ministryId) } } } }
        : {}),
    },
    select: { id: true, fullName: true, status: true },
    orderBy: { fullName: "asc" },
    take: 10,
  });

  return people.map((person) => ({ id: person.id, fullName: person.fullName, status: person.status as "VISITOR" | "MEMBER" }));
}

export async function addPersonToAttendance(actor: MeetingActor, meetingId: string, personId: string) {
  const meeting = await getMeetingForQuery(meetingId);
  assertMeetingAccess(actor, meeting);
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true, fullName: true, status: true } });
  if (!person || person.status === "INACTIVE") throw new Error("Pessoa não encontrada.");

  return withTransaction(async (transaction) => {
    await transaction.attendance.createMany({
      data: { meetingId, personId, status: "NOT_CONFIRMED" as AttendanceStatus },
      skipDuplicates: true,
    });
    return transaction.attendance.findUniqueOrThrow({ where: { meetingId_personId: { meetingId, personId } }, include: { person: true } });
  });
}

export async function addQuickVisitor(actor: MeetingActor, meetingId: string, fullName: string) {
  return registerContextualVisitor(actor, meetingId, fullName);
}

export function summarizeAttendance(rows: ReadonlyArray<{ status: AttendanceStatus }>) {
  return rows.reduce(
    (summary, row) => ({ ...summary, [row.status]: summary[row.status] + 1 }),
    { NOT_CONFIRMED: 0, PRESENT: 0, ABSENT: 0 },
  );
}
