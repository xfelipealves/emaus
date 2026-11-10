import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { TONES } from "@/lib/labels";
import { addDaysIso, startOfDayUtc, todayIso } from "@/lib/dates";
import { recordAudit, recordTimeline } from "./history";
import { ActionError, assertCanSeePerson, type CurrentUser } from "./session";
import { getSettings } from "./settings";

export const ministryInput = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
  description: z.string().trim().max(400).optional(),
  color: z.enum(TONES).default("ember"),
});

function scopeWhere(user: CurrentUser) {
  if (!user.ministryIds) return undefined;
  return user.ministryIds.length
    ? inArray(schema.ministry.id, user.ministryIds)
    : sql`0`;
}

export async function listMinistries(user: CurrentUser, opts: { includeArchived?: boolean } = {}) {
  const ministries = await db.query.ministry.findMany({
    where: and(scopeWhere(user), opts.includeArchived ? undefined : eq(schema.ministry.archived, false)),
    orderBy: asc(sql`lower(${schema.ministry.name})`),
    with: {
      memberships: {
        where: isNull(schema.membership.endDate),
        with: { person: { columns: { id: true, fullName: true, preferredName: true } } },
      },
    },
  });
  return ministries.map((m) => ({
    ...m,
    memberCount: m.memberships.length,
    leaders: m.memberships.filter((x) => x.role === "leader").map((x) => x.person),
  }));
}

export async function getMinistry(user: CurrentUser, id: string) {
  if (user.ministryIds && !user.ministryIds.includes(id)) return null;
  const m = await db.query.ministry.findFirst({
    where: eq(schema.ministry.id, id),
    with: {
      memberships: {
        with: { person: true },
        orderBy: [asc(schema.membership.endDate), desc(schema.membership.startDate)],
      },
    },
  });
  return m ?? null;
}

/** Presença semanal dos membros do ministério nas últimas N semanas. */
export async function ministryAttendanceTrend(ministryId: string, weeks = 12) {
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const from = startOfDayUtc(addDaysIso(today, -weeks * 7), settings.timezone);
  const memberIds = (
    await db
      .select({ id: schema.membership.personId })
      .from(schema.membership)
      .where(and(eq(schema.membership.ministryId, ministryId), isNull(schema.membership.endDate)))
  ).map((r) => r.id);
  if (!memberIds.length) return { memberCount: 0, points: [] as { week: string; present: number }[] };

  const rows = await db
    .select({ startsAt: schema.event.startsAt, personId: schema.attendance.personId })
    .from(schema.attendance)
    .innerJoin(schema.event, eq(schema.event.id, schema.attendance.eventId))
    .where(
      and(
        eq(schema.attendance.status, "present"),
        inArray(schema.attendance.personId, memberIds),
        gte(schema.event.startsAt, from),
      ),
    );
  return { memberCount: memberIds.length, points: weeklyUnique(rows, today, weeks, settings.timezone) };
}

/** Agrupa presenças por semana (pessoas únicas por semana). */
/** Pessoas únicas com presença em cada uma das últimas N semanas (a mais recente termina hoje). */
export function weekBuckets(
  rows: { startsAt: Date; personId: string }[],
  today: string,
  weeks: number,
  timeZone: string,
) {
  // Limites calculados uma vez: conversão de fuso é cara no Raspberry.
  const buckets = Array.from({ length: weeks }, (_, k) => {
    const week = addDaysIso(today, -(weeks - 1 - k) * 7 - 6);
    return { week, from: startOfDayUtc(week, timeZone).getTime(), people: new Set<string>() };
  });
  for (const r of rows) {
    const t = r.startsAt.getTime();
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (t >= buckets[i].from) {
        buckets[i].people.add(r.personId);
        break;
      }
    }
  }
  return buckets;
}

export function weeklyUnique(
  rows: { startsAt: Date; personId: string }[],
  today: string,
  weeks: number,
  timeZone: string,
) {
  return weekBuckets(rows, today, weeks, timeZone).map((b) => ({ week: b.week, present: b.people.size }));
}

export async function createMinistry(user: CurrentUser, raw: unknown) {
  const input = ministryInput.parse(raw);
  const [created] = await db
    .insert(schema.ministry)
    .values({ name: input.name, description: input.description ?? null, color: input.color })
    .returning();
  await recordAudit(db, {
    actorId: user.id,
    entity: "ministry",
    entityId: created.id,
    action: "create",
    summary: `Ministério ${created.name} criado`,
  });
  return created;
}

export async function updateMinistry(user: CurrentUser, id: string, raw: unknown) {
  const input = ministryInput.parse(raw);
  await db
    .update(schema.ministry)
    .set({ name: input.name, description: input.description ?? null, color: input.color })
    .where(eq(schema.ministry.id, id));
}

export async function setMinistryArchived(user: CurrentUser, id: string, archived: boolean) {
  const m = await db.query.ministry.findFirst({ where: eq(schema.ministry.id, id) });
  if (!m) throw new ActionError("Ministério não encontrado.");
  await db.update(schema.ministry).set({ archived }).where(eq(schema.ministry.id, id));
  await recordAudit(db, {
    actorId: user.id,
    entity: "ministry",
    entityId: id,
    action: archived ? "archive" : "restore",
    summary: `Ministério ${m.name} ${archived ? "arquivado" : "reativado"}`,
  });
}

export async function addMember(
  user: CurrentUser,
  ministryId: string,
  personId: string,
  role: "member" | "leader" = "member",
) {
  if (user.ministryIds && !user.ministryIds.includes(ministryId)) {
    throw new ActionError("Você não tem acesso a este ministério.");
  }
  // Líder não amplia o próprio escopo trazendo alguém que ele ainda não acompanha.
  await assertCanSeePerson(user, personId);
  const settings = await getSettings();
  const m = await db.query.ministry.findFirst({ where: eq(schema.ministry.id, ministryId) });
  if (!m) throw new ActionError("Ministério não encontrado.");
  const active = await db.query.membership.findFirst({
    where: and(
      eq(schema.membership.ministryId, ministryId),
      eq(schema.membership.personId, personId),
      isNull(schema.membership.endDate),
    ),
  });
  if (active) throw new ActionError("Essa pessoa já participa deste ministério.");
  await db.transaction(async (tx) => {
    // O índice único de vínculo ativo barra corrida entre dois cliques/abas.
    const [created] = await tx
      .insert(schema.membership)
      .values({ ministryId, personId, role, startDate: todayIso(settings.timezone) })
      .onConflictDoNothing()
      .returning();
    if (!created) throw new ActionError("Essa pessoa já participa deste ministério.");
    await recordTimeline(tx, {
      personId,
      actorId: user.id,
      kind: "ministry",
      title: role === "leader" ? `Passou a liderar ${m.name}` : `Entrou em ${m.name}`,
    });
  });
}

export async function setMembershipRole(user: CurrentUser, membershipId: string, role: "member" | "leader") {
  const ms = await db.query.membership.findFirst({
    where: eq(schema.membership.id, membershipId),
    with: { ministry: true },
  });
  if (!ms) throw new ActionError("Vínculo não encontrado.");
  if (user.ministryIds && !user.ministryIds.includes(ms.ministryId)) {
    throw new ActionError("Você não tem acesso a este ministério.");
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.membership).set({ role }).where(eq(schema.membership.id, membershipId));
    await recordTimeline(tx, {
      personId: ms.personId,
      actorId: user.id,
      kind: "ministry",
      title: role === "leader" ? `Passou a liderar ${ms.ministry.name}` : `Deixou a liderança de ${ms.ministry.name}`,
    });
  });
}

export async function endMembership(user: CurrentUser, membershipId: string) {
  const settings = await getSettings();
  const ms = await db.query.membership.findFirst({
    where: eq(schema.membership.id, membershipId),
    with: { ministry: true },
  });
  if (!ms || ms.endDate) throw new ActionError("Vínculo não encontrado.");
  if (user.ministryIds && !user.ministryIds.includes(ms.ministryId)) {
    throw new ActionError("Você não tem acesso a este ministério.");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(schema.membership)
      .set({ endDate: todayIso(settings.timezone) })
      .where(eq(schema.membership.id, membershipId));
    await recordTimeline(tx, {
      personId: ms.personId,
      actorId: user.id,
      kind: "ministry",
      title: `Saiu de ${ms.ministry.name}`,
    });
  });
}
