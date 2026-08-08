import type { RecurrencePattern } from "@prisma/client";
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
};

function assertAdministrator(actor: SeriesActor) {
  if (!canManageMinistry(actor)) {
    throw new Error("Apenas administradores podem gerenciar séries.");
  }
}

function dateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeInput(input: SeriesInput) {
  const name = input.name.trim();
  const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
  const startDate = dateOnly(input.startDate);
  const endDate = input.endDate ? dateOnly(input.endDate) : null;

  if (!name) throw new Error("Nome da série é obrigatório.");
  if (!weekdays.length || weekdays.some((day) => day < 1 || day > 7)) {
    throw new Error("Selecione ao menos um dia da semana válido.");
  }
  if (endDate && endDate < startDate) throw new Error("O término não pode anteceder o início.");

  return { ...input, name, weekdays, startDate, endDate };
}

function isoWeekday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function daysBetween(start: Date, current: Date) {
  return Math.floor((current.getTime() - start.getTime()) / 86_400_000);
}

export function recurrenceDates(input: { recurrence: RecurrencePattern; weekdays: number[]; startDate: Date; endDate: Date | null }, throughDate: Date) {
  const startDate = dateOnly(input.startDate);
  const endDate = input.endDate && dateOnly(input.endDate);
  const through = dateOnly(throughDate);
  const lastDate = endDate && endDate < through ? endDate : through;
  if (lastDate < startDate) return [];

  const selected = new Set(input.weekdays);
  const dates: Date[] = [];
  for (let current = startDate; current <= lastDate; current = new Date(current.getTime() + 86_400_000)) {
    if (!selected.has(isoWeekday(current))) continue;

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
  const data = normalizeInput(input);

  return withTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Categoria não encontrada.");
    const series = await transaction.meetingSeries.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        recurrence: data.recurrence,
        weekdays: data.weekdays,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MeetingSeries",
      targetId: series.id,
      action: "CREATE",
      after: { id: series.id, categoryId: series.categoryId, name: series.name, recurrence: series.recurrence, weekdays: series.weekdays, startDate: series.startDate.toISOString(), endDate: series.endDate?.toISOString() ?? null },
    });
    return series;
  });
}

export async function generateSeriesOccurrences(actor: SeriesActor, seriesId: string, throughDate: Date) {
  assertAdministrator(actor);

  return withTransaction(async (transaction) => {
    const series = await transaction.meetingSeries.findUnique({ where: { id: seriesId } });
    if (!series) throw new Error("Série não encontrada.");
    const dates = recurrenceDates(series, throughDate);
    const occurrences = [];

    for (const scheduledAt of dates) {
      const existing = await transaction.meeting.findFirst({ where: { seriesId, scheduledAt } });
      if (existing) {
        occurrences.push(existing);
        continue;
      }
      occurrences.push(await transaction.meeting.create({
        data: { categoryId: series.categoryId, seriesId, title: series.name, scheduledAt, status: "DRAFT" },
      }));
    }
    return occurrences;
  });
}
