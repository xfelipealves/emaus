import type { AccountRole, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type AuditEventRecord = Prisma.AuditEventGetPayload<{
  include: { actor: { include: { person: { select: { fullName: true } } } } };
}>;

export type AuditEventItem = AuditEventRecord & {
  attendanceContext?: { personName: string; meetingTitle: string } | null;
};

export type AuditQueryActor = {
  id: string;
  role: AccountRole;
};

function assertAdministrator(actor: AuditQueryActor) {
  if (actor.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem consultar a auditoria.");
  }
}

export async function listAuditEvents(actor: AuditQueryActor): Promise<AuditEventItem[]> {
  assertAdministrator(actor);

  const account = await prisma.account.findUnique({
    where: { id: actor.id },
    select: { role: true, status: true },
  });
  if (!account || account.status !== "ACTIVE" || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem consultar a auditoria.");
  }

  const events = await prisma.auditEvent.findMany({
    include: { actor: { include: { person: { select: { fullName: true } } } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const attendanceIds = [...new Set(
    events.filter((event) => event.targetType === "Attendance").map((event) => event.targetId),
  )];
  if (attendanceIds.length === 0) return events;

  const attendances = await prisma.attendance.findMany({
    where: { id: { in: attendanceIds } },
    select: {
      id: true,
      person: { select: { fullName: true } },
      meeting: { select: { title: true } },
    },
  });
  const contexts = new Map(attendances.map((attendance) => [attendance.id, {
    personName: attendance.person.fullName,
    meetingTitle: attendance.meeting.title,
  }]));

  return events.map((event) => event.targetType === "Attendance"
    ? { ...event, attendanceContext: contexts.get(event.targetId) ?? null }
    : event);
}
