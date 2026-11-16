import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { startOfDayUtc, todayIso } from "@/lib/dates";
import { ActionError, type CurrentUser } from "../session";
import { getPlatformSettings, getSettings } from "../settings";

/** O dia do teto global da plataforma vira à meia-noite de Brasília. */
export const PLATFORM_TIMEZONE = "America/Sao_Paulo";

async function spentSince(since: Date, where?: ReturnType<typeof and>) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.aiRun.costUsd}), 0)` })
    .from(schema.aiRun)
    .where(and(gte(schema.aiRun.createdAt, since), where));
  return row?.total ?? 0;
}

export type BudgetLine = { spent: number; cap: number | null };

/** Gasto de hoje com IA contra os tetos: da igreja, do usuário e da plataforma toda. */
export async function aiBudgetStatus(churchId: string, userId?: string) {
  const [church, platform] = await Promise.all([getSettings(churchId), getPlatformSettings()]);
  const churchDay = startOfDayUtc(todayIso(church.timezone), church.timezone);
  const platformDay = startOfDayUtc(todayIso(PLATFORM_TIMEZONE), PLATFORM_TIMEZONE);
  const [churchSpent, userSpent, platformSpent] = await Promise.all([
    spentSince(churchDay, and(eq(schema.aiRun.churchId, churchId))),
    userId ? spentSince(churchDay, and(eq(schema.aiRun.churchId, churchId), eq(schema.aiRun.userId, userId))) : 0,
    spentSince(platformDay),
  ]);
  return {
    church: { spent: churchSpent, cap: church.aiDailyBudgetUsd } satisfies BudgetLine,
    user: { spent: userSpent, cap: church.aiUserDailyBudgetUsd } satisfies BudgetLine,
    platform: { spent: platformSpent, cap: platform.aiDailyBudgetUsd } satisfies BudgetLine,
  };
}

const over = (line: BudgetLine) => line.cap !== null && line.spent >= line.cap;

/**
 * Barra a pergunta quando algum teto do dia já foi atingido. A checagem é antes de começar:
 * uma pergunta em andamento termina mesmo que passe um pouco do teto.
 */
export async function assertAiBudget(user: CurrentUser) {
  const status = await aiBudgetStatus(user.churchId, user.id);
  if (over(status.platform) || over(status.church)) {
    throw new ActionError("O limite diário de uso da IA desta igreja foi atingido. O assistente volta amanhã.");
  }
  if (over(status.user)) {
    throw new ActionError("Você atingiu o seu limite diário de uso da IA. O assistente volta amanhã.");
  }
}
