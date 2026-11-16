import "server-only";
import { and, asc, count, eq, gte, isNotNull, isNull, lte, sql, sum } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db, schema } from "@/db";
import { normalizeSearch } from "@/lib/text";
import { recordAudit } from "./history";
import { type Account, ActionError } from "./session";
import { createUserAccount, passwordRule } from "./users";

/**
 * Painel da plataforma: métricas agregadas por igreja. Só contagens e somas — nada de nomes
 * de pessoas, anotações ou perguntas feitas à IA.
 */

type Counts = Map<string, number>;

async function countByChurch(column: SQLiteColumn, where?: ReturnType<typeof and>): Promise<Counts> {
  const table = column.table;
  const rows = await db
    .select({ churchId: column, n: count() })
    .from(table)
    .where(where)
    .groupBy(column);
  return new Map(rows.map((r) => [r.churchId as string, r.n]));
}

export async function listChurchesWithMetrics(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const now = new Date();
  const [churches, users, people, visitors, events, attendance, kiosk, qr, openFollowUps, doneFollowUps, notes, aiRows, lastSeen] =
    await Promise.all([
      db.query.church.findMany({ orderBy: asc(schema.church.name) }),
      countByChurch(schema.user.churchId, eq(schema.user.active, true)),
      countByChurch(schema.person.churchId, sql`${schema.person.status} != 'inactive'`),
      countByChurch(schema.person.churchId, eq(schema.person.status, "visitor")),
      countByChurch(schema.event.churchId, and(gte(schema.event.startsAt, since), lte(schema.event.startsAt, now), eq(schema.event.cancelled, false))),
      countByChurch(schema.attendance.churchId, and(gte(schema.attendance.createdAt, since), eq(schema.attendance.status, "present"))),
      countByChurch(schema.attendance.churchId, and(gte(schema.attendance.createdAt, since), eq(schema.attendance.method, "kiosk"))),
      countByChurch(schema.attendance.churchId, and(gte(schema.attendance.createdAt, since), eq(schema.attendance.method, "qr"))),
      countByChurch(schema.followUp.churchId, isNull(schema.followUp.doneAt)),
      countByChurch(schema.followUp.churchId, and(isNotNull(schema.followUp.doneAt), gte(schema.followUp.doneAt, since))),
      countByChurch(schema.note.churchId, gte(schema.note.createdAt, since)),
      db
        .select({
          churchId: schema.aiRun.churchId,
          runs: count(),
          cost: sum(schema.aiRun.costUsd).mapWith(Number),
          errors: sql<number>`sum(case when ${schema.aiRun.error} is not null then 1 else 0 end)`,
          bad: sql<number>`sum(case when ${schema.aiRun.rating} = -1 then 1 else 0 end)`,
        })
        .from(schema.aiRun)
        .where(gte(schema.aiRun.createdAt, since))
        .groupBy(schema.aiRun.churchId),
      db
        .select({ churchId: schema.user.churchId, last: sql<number | null>`max(${schema.session.updatedAt})` })
        .from(schema.session)
        .innerJoin(schema.user, eq(schema.user.id, schema.session.userId))
        .groupBy(schema.user.churchId),
    ]);
  const ai = new Map(aiRows.map((r) => [r.churchId, r]));
  const seen = new Map(lastSeen.map((r) => [r.churchId, r.last ? new Date(r.last) : null]));
  return churches.map((c) => ({
    ...c,
    metrics: {
      users: users.get(c.id) ?? 0,
      people: people.get(c.id) ?? 0,
      visitors: visitors.get(c.id) ?? 0,
      events: events.get(c.id) ?? 0,
      attendance: attendance.get(c.id) ?? 0,
      kiosk: kiosk.get(c.id) ?? 0,
      qr: qr.get(c.id) ?? 0,
      openFollowUps: openFollowUps.get(c.id) ?? 0,
      doneFollowUps: doneFollowUps.get(c.id) ?? 0,
      notes: notes.get(c.id) ?? 0,
      aiRuns: ai.get(c.id)?.runs ?? 0,
      aiCost: ai.get(c.id)?.cost ?? 0,
      aiErrors: ai.get(c.id)?.errors ?? 0,
      aiBad: ai.get(c.id)?.bad ?? 0,
      lastSeen: seen.get(c.id) ?? null,
    },
  }));
}

export async function getChurchForPlatform(id: string) {
  const church = await db.query.church.findFirst({ where: eq(schema.church.id, id) });
  if (!church) return null;
  const users = await db.query.user.findMany({
    where: eq(schema.user.churchId, id),
    columns: { id: true, name: true, username: true, role: true, active: true, mustChangePassword: true },
    orderBy: asc(schema.user.name),
  });
  const seen = await db
    .select({ userId: schema.session.userId, last: sql<number>`max(${schema.session.updatedAt})` })
    .from(schema.session)
    .innerJoin(schema.user, eq(schema.user.id, schema.session.userId))
    .where(eq(schema.user.churchId, id))
    .groupBy(schema.session.userId);
  const lastSeen = new Map(seen.map((s) => [s.userId, new Date(s.last)]));
  return { church, users: users.map((u) => ({ ...u, lastSeen: lastSeen.get(u.id) ?? null })) };
}

/* ───────────── Gestão ───────────── */

const budget = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(String(v).replace(",", "."))),
  z.number().min(0, "Use um valor positivo").max(10_000).nullable(),
);

export const churchBudgetInput = z.object({ aiDailyBudgetUsd: budget, aiUserDailyBudgetUsd: budget });
export const platformBudgetInput = z.object({ aiDailyBudgetUsd: budget });

export const newChurchInput = z.object({
  name: z.string().trim().min(2, "Informe o nome da igreja").max(80),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido"),
  adminName: z.string().trim().min(2, "Informe o nome").max(80),
  adminUsername: z.string(),
  adminEmail: z.string(),
  password: passwordRule,
});

/** "Igreja Batista Central" → "igreja-batista-central" (com sufixo se já existir). */
async function uniqueSlug(name: string) {
  const base = normalizeSearch(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "igreja";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!(await db.query.church.findFirst({ where: eq(schema.church.slug, slug), columns: { id: true } }))) return slug;
  }
}

/** Cria a igreja e a conta de administrador dela (com troca de senha no primeiro acesso). */
export async function createChurch(operator: Account, raw: unknown) {
  const input = newChurchInput.parse(raw);
  const [church] = await db
    .insert(schema.church)
    .values({ slug: await uniqueSlug(input.name), name: input.name, timezone: input.timezone })
    .returning();
  try {
    await createUserAccount(
      { id: operator.id, churchId: church.id, demo: false },
      { name: input.adminName, username: input.adminUsername, email: input.adminEmail, role: "admin" },
      input.password,
    );
  } catch (err) {
    // Sem administrador a igreja ficaria inacessível: desfaz.
    await db.delete(schema.church).where(eq(schema.church.id, church.id));
    throw err;
  }
  await recordAudit(db, {
    churchId: church.id,
    actorId: operator.id,
    entity: "church",
    entityId: church.id,
    action: "create",
    summary: `Igreja ${church.name} criada pela plataforma`,
  });
  return church;
}

export async function setChurchActive(operator: Account, id: string, active: boolean) {
  const [church] = await db.update(schema.church).set({ active }).where(eq(schema.church.id, id)).returning();
  if (!church) throw new ActionError("Igreja não encontrada.");
  if (!active) {
    // Suspensão vale na hora: derruba as sessões abertas da igreja.
    const users = db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.churchId, id));
    await db.delete(schema.session).where(sql`${schema.session.userId} in ${users}`);
  }
  await recordAudit(db, {
    churchId: id,
    actorId: operator.id,
    entity: "church",
    entityId: id,
    action: active ? "activate" : "suspend",
    summary: `Acesso da igreja ${active ? "reativado" : "suspenso"} pela plataforma`,
  });
}

export async function setChurchBudget(operator: Account, id: string, raw: unknown) {
  const input = churchBudgetInput.parse(raw);
  const [church] = await db.update(schema.church).set(input).where(eq(schema.church.id, id)).returning();
  if (!church) throw new ActionError("Igreja não encontrada.");
  await recordAudit(db, {
    churchId: id,
    actorId: operator.id,
    entity: "church",
    entityId: id,
    action: "ai.budget",
    summary: "Limites diários de IA alterados pela plataforma",
    after: input,
  });
}

export async function setPlatformBudget(raw: unknown) {
  const input = platformBudgetInput.parse(raw);
  await db
    .insert(schema.platformSettings)
    .values({ id: 1, ...input })
    .onConflictDoUpdate({ target: schema.platformSettings.id, set: input });
}
