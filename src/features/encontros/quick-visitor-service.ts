import type { MeetingStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canManageMeeting } from "../../server/authorization";
import { recordAuditEvent, recordTimelineEvent } from "../../server/audit";
import type { MeetingActor } from "./meeting-service";

function assertMeetingAccess(
  actor: MeetingActor,
  meeting: { audiences: Array<{ ministryId: string; ministry: { status: string } }>; status: MeetingStatus } | null,
) {
  if (!meeting || !canManageMeeting(actor, meeting.audiences.map((audience) => audience.ministryId))) {
    throw new Error("Encontro não encontrado.");
  }
  if (meeting.status === "CANCELLED") {
    throw new Error("Encontro cancelado não aceita lançamentos de presença.");
  }
  if (meeting.audiences.some((audience) => audience.ministry.status === "ARCHIVED")) {
    throw new Error("Ministério arquivado não aceita novos lançamentos de presença.");
  }
}

export async function registerContextualVisitor(actor: MeetingActor, meetingId: string, fullName: string) {
  const normalizedName = fullName.trim();
  if (!normalizedName) throw new Error("Nome completo é obrigatório.");

  return prisma.$transaction(async (transaction) => {
    const account = await transaction.account.findUnique({
      where: { id: actor.id },
      select: {
        role: true,
        status: true,
        ministryAccess: { where: { revokedAt: null }, select: { ministryId: true, revokedAt: true } },
      },
    });
    if (!account || account.status !== "ACTIVE" || account.role !== actor.role) {
      throw new Error("Sessão inválida.");
    }

    const meeting = await transaction.meeting.findUnique({
      where: { id: meetingId },
      include: { audiences: { include: { ministry: { select: { status: true } } } } },
    });
    const persistedActor: MeetingActor = {
      id: actor.id,
      role: account.role,
      ministryAccess: account.ministryAccess,
    };
    assertMeetingAccess(persistedActor, meeting);

    const person = await transaction.person.create({
      data: { fullName: normalizedName, status: "VISITOR" },
    });
    await recordTimelineEvent(transaction, {
      personId: person.id,
      category: "REGISTRATION",
      title: "Pessoa cadastrada",
      description: person.fullName,
      occurredAt: person.createdAt,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Person",
      targetId: person.id,
      action: "CREATE",
      after: {
        id: person.id,
        fullName: person.fullName,
        status: person.status,
        phone: person.phone,
        birthDate: person.birthDate?.toISOString() ?? null,
        profilePhotoUrl: person.profilePhotoUrl,
      },
    });

    return transaction.attendance.create({
      data: { meetingId, personId: person.id, status: "NOT_CONFIRMED" },
      include: { person: true },
    });
  });
}
