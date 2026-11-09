import type { RecurrencePattern } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canManageMinistry, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type SeriesActor = Pick<AuthorizationAccount, "role" | "ministryAccess"> & { id: string };

export type SeriesInput = {
  categoryId: string;
  name: string;
  recurrence: RecurrencePattern;
  weekdays: number[];
  startDate: Date;
  endDate?: Date;
  ministryIds?: string[];
};

function assertAdministrator(actor: SeriesActor) {
  if (!canManageMinistry(actor)) {
    throw new Error("Apenas administradores podem gerenciar séries.");
  }
}

function dateOnly(date: Date) {
  if (!Number.isFinite(date.getTime())) throw new Error("Data inválida.");
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
}

export function normalizeSeriesInput(input: SeriesInput) {
  const categoryId = input.categoryId.trim();
  const name = input.name.trim();
  const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
  const ministryIds = [...new Set((input.ministryIds ?? []).map((ministryId) => ministryId.trim()).filter(Boolean))];
  if (!categoryId) throw new Error("Categoria da série é obrigatória.");
  if (!["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(input.recurrence)) {
    throw new Error("Padrão de recorrência inválido.");
  }
  if (!Number.isFinite(input.startDate.getTime())) throw new Error("Data inicial inválida.");
  if (input.endDate && !Number.isFinite(input.endDate.getTime())) throw new Error("Data final inválida.");
  const startDate = dateOnly(input.startDate);
  const endDate = input.endDate ? dateOnly(input.endDate) : null;

  if (!name) throw new Error("Nome da série é obrigatório.");
  if (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error("Selecione ao menos um dia da semana válido.");
  }
  if (endDate && endDate < startDate) throw new Error("O término não pode anteceder o início.");

  return { ...input, categoryId, name, weekdays, startDate, endDate, ministryIds };
}

function isoWeekday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function daysBetween(start: Date, current: Date) {
  return Math.floor((current.getTime() - start.getTime()) / 86_400_000);
}

function weekOfMonth(date: Date) {
  return Math.floor((date.getUTCDate() - 1) / 7) + 1;
}

export function recurrenceDates(input: { recurrence: RecurrencePattern; weekdays: number[]; startDate: Date; endDate: Date | null }, throughDate: Date) {
  const startDate = dateOnly(input.startDate);
  const endDate = input.endDate && dateOnly(input.endDate);
  const through = dateOnly(throughDate);
  const lastDate = endDate && endDate < through ? endDate : through;
  if (lastDate < startDate) return [];

  const selected = new Set(input.weekdays);
  const monthlyOrdinal = weekOfMonth(startDate);
  const dates: Date[] = [];
  for (let current = startDate; current <= lastDate; current = new Date(current.getTime() + 86_400_000)) {
    if (!selected.has(isoWeekday(current))) continue;

    if (input.recurrence === "MONTHLY" && weekOfMonth(current) !== monthlyOrdinal) continue;
    if (input.recurrence === "WEEKLY" || input.recurrence === "BIWEEKLY") {
      const weeks = Math.floor(daysBetween(startDate, current) / 7);
      if (input.recurrence === "BIWEEKLY" && weeks % 2 !== 0) continue;
    }
    dates.push(current);
  }
  return dates;
}

export async function createSeries(actor: SeriesActor, input: SeriesInput) {
  assertAdministrator(actor);
  const data = normalizeSeriesInput(input);

  return withTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Categoria não encontrada.");
    if (data.ministryIds.length) {
      const ministries = await transaction.ministry.findMany({ where: { id: { in: data.ministryIds } }, select: { id: true, status: true } });
      if (ministries.length !== data.ministryIds.length) throw new Error("Ministério não encontrado.");
      if (ministries.some((ministry) => ministry.status === "ARCHIVED")) throw new Error("Ministério arquivado não aceita novas séries.");
    }
    const series = await transaction.meetingSeries.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        recurrence: data.recurrence,
        weekdays: data.weekdays,
        startDate: data.startDate,
        endDate: data.endDate,
        audiences: { create: data.ministryIds.map((ministryId) => ({ ministryId })) },
      },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MeetingSeries",
      targetId: series.id,
      action: "CREATE",
      after: { id: series.id, categoryId: series.categoryId, name: series.name, recurrence: series.recurrence, weekdays: series.weekdays, startDate: series.startDate.toISOString(), endDate: series.endDate?.toISOString() ?? null, ministryIds: data.ministryIds },
    });
    return series;
  });
}

export async function listSeries(actor: SeriesActor) {
  assertAdministrator(actor);
  return prisma.meetingSeries.findMany({
    include: {
      category: { select: { id: true, name: true } },
      audiences: { include: { ministry: { select: { name: true, status: true } } } },
      _count: { select: { meetings: true } },
    },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });
}

export async function updateSeries(actor: SeriesActor, seriesId: string, input: SeriesInput) {
  assertAdministrator(actor);
  const data = normalizeSeriesInput(input);

  return withTransaction(async (transaction) => {
    const current = await transaction.meetingSeries.findUnique({
      where: { id: seriesId },
      include: { audiences: { select: { ministryId: true } } },
    });
    if (!current) throw new Error("Série não encontrada.");
    const category = await transaction.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Categoria não encontrada.");
    if (data.ministryIds.length) {
      const ministries = await transaction.ministry.findMany({ where: { id: { in: data.ministryIds } }, select: { id: true, status: true } });
      if (ministries.length !== data.ministryIds.length) throw new Error("Ministério não encontrado.");
      const currentMinistryIds = new Set(current.audiences.map((audience) => audience.ministryId));
      if (ministries.some((ministry) => ministry.status === "ARCHIVED" && !currentMinistryIds.has(ministry.id))) {
        throw new Error("Ministério arquivado não aceita novas séries.");
      }
    }

    const updated = await transaction.meetingSeries.update({
      where: { id: seriesId },
      data: {
        categoryId: data.categoryId,
        name: data.name,
        recurrence: data.recurrence,
        weekdays: data.weekdays,
        startDate: data.startDate,
        endDate: data.endDate,
        audiences: {
          deleteMany: {},
          create: data.ministryIds.map((ministryId) => ({ ministryId })),
        },
      },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MeetingSeries",
      targetId: seriesId,
      action: "UPDATE",
      before: { id: current.id, categoryId: current.categoryId, name: current.name, recurrence: current.recurrence, weekdays: current.weekdays, startDate: current.startDate.toISOString(), endDate: current.endDate?.toISOString() ?? null, ministryIds: current.audiences.map((audience) => audience.ministryId) },
      after: { id: updated.id, categoryId: updated.categoryId, name: updated.name, recurrence: updated.recurrence, weekdays: updated.weekdays, startDate: updated.startDate.toISOString(), endDate: updated.endDate?.toISOString() ?? null, ministryIds: data.ministryIds },
    });
    return updated;
  });
}

export async function generateSeriesOccurrences(actor: SeriesActor, seriesId: string, throughDate: Date) {
  assertAdministrator(actor);

  return withTransaction(async (transaction) => {
    const series = await transaction.meetingSeries.findUnique({
      where: { id: seriesId },
      include: { audiences: { select: { ministryId: true } } },
    });
    if (!series) throw new Error("Série não encontrada.");
    if (series.audiences.length) {
      const ministries = await transaction.ministry.findMany({
        where: { id: { in: series.audiences.map((audience) => audience.ministryId) } },
        select: { id: true, status: true },
      });
      if (ministries.some((ministry) => ministry.status === "ARCHIVED")) {
        throw new Error("A série inclui Ministério arquivado. Atualize o público antes de gerar novas ocorrências.");
      }
    }
    const dates = recurrenceDates(series, throughDate);
    const occurrences = [];

    for (const scheduledAt of dates) {
      const existing = await transaction.meeting.findFirst({ where: { seriesId, scheduledAt } });
      if (existing) {
        occurrences.push(existing);
        continue;
      }
      occurrences.push(await transaction.meeting.create({
        data: {
          categoryId: series.categoryId,
          seriesId,
          title: series.name,
          scheduledAt,
          status: "DRAFT",
          audiences: { create: series.audiences.map((audience) => ({ ministryId: audience.ministryId })) },
        },
      }));
    }
    return occurrences;
  });
}
