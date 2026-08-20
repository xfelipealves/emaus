import type { MeetingStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canAccessMinistry, canManageMeeting, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type MeetingActor = Pick<AuthorizationAccount, "role" | "ministryAccess"> & { id: string };

export type MeetingInput = {
  categoryId: string;
  title: string;
  scheduledAt: Date;
  status?: MeetingStatus;
  wholeChurch: boolean;
  ministryIds?: string[];
};

function normalizeInput(input: MeetingInput) {
  const title = input.title.trim();
  const ministryIds = [...new Set(input.ministryIds ?? [])];
  if (!title) throw new Error("Título do encontro é obrigatório.");
  if (Number.isNaN(input.scheduledAt.getTime())) throw new Error("Data e horário do encontro são obrigatórios.");
  if (!input.wholeChurch && ministryIds.length === 0) throw new Error("Selecione ao menos um Ministério ou toda a igreja.");
  if (input.wholeChurch && ministryIds.length > 0) throw new Error("Escolha toda a igreja ou Ministérios específicos.");
  return { ...input, title, ministryIds, status: input.status ?? "DRAFT" };
}

function meetingSnapshot(meeting: { id: string; categoryId: string; title: string; scheduledAt: Date; status: MeetingStatus }, ministryIds: string[]) {
  return { id: meeting.id, categoryId: meeting.categoryId, title: meeting.title, scheduledAt: meeting.scheduledAt.toISOString(), status: meeting.status, ministryIds };
}

export async function getMeetingActor(accountId: string): Promise<MeetingActor | null> {
  return prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, role: true, ministryAccess: { select: { ministryId: true, revokedAt: true } } },
  });
}

export async function listMeetingOptions(actor: MeetingActor) {
  const ministries = await prisma.ministry.findMany({
    where: { status: "ACTIVE", ...(actor.role === "LEADER" ? { id: { in: actor.ministryAccess.filter((access) => access.revokedAt === null).map((access) => access.ministryId) } } : {}) },
    orderBy: { name: "asc" },
  });
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return { ministries, categories };
}

export async function listMeetings(actor: MeetingActor) {
  const meetings = await prisma.meeting.findMany({ include: { category: true, audiences: { include: { ministry: true } } }, orderBy: { scheduledAt: "asc" } });
  return actor.role === "LEADER"
    ? meetings.filter((meeting) => meeting.audiences.length > 0 && meeting.audiences.every((audience) => canAccessMinistry(actor, audience.ministryId)))
    : meetings;
}

export async function createMeeting(actor: MeetingActor, input: MeetingInput) {
  const data = normalizeInput(input);
  const audienceMinistryIds = data.wholeChurch ? [] : data.ministryIds;
  if (!canManageMeeting(actor, audienceMinistryIds)) throw new Error("Você não tem escopo para criar este encontro.");

  return withTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Categoria não encontrada.");
    if (audienceMinistryIds.length) {
      const ministries = await transaction.ministry.findMany({ where: { id: { in: audienceMinistryIds } }, select: { id: true, status: true } });
      if (ministries.length !== audienceMinistryIds.length) throw new Error("Ministério não encontrado.");
      if (ministries.some((ministry) => ministry.status === "ARCHIVED")) throw new Error("Ministério arquivado não aceita novos encontros.");
    }

    const meeting = await transaction.meeting.create({
      data: { categoryId: data.categoryId, title: data.title, scheduledAt: data.scheduledAt, status: data.status, audiences: { create: audienceMinistryIds.map((ministryId) => ({ ministryId })) } },
      include: { audiences: true },
    });
    await recordAuditEvent(transaction, { actorId: actor.id, targetType: "Meeting", targetId: meeting.id, action: "CREATE", after: meetingSnapshot(meeting, audienceMinistryIds) });
    return meeting;
  });
}
