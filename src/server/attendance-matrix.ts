import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysIso, isoDateInTz, startOfDayUtc, todayIso } from "@/lib/dates";
import { getSettings } from "./settings";

export type MatrixCell = {
  eventId: string;
  title: string;
  startsAt: Date;
  /** missed = chamada lançada sem a pessoa; unknown = ninguém lançou a chamada. */
  status: "present" | "absent" | "missed" | "unknown";
};

export type MatrixRow = {
  key: string;
  label: string;
  color: string;
  /** Uma lista por semana (normalmente 0 ou 1 encontro). */
  weeks: MatrixCell[][];
};

/**
 * Chamada da pessoa nas últimas N semanas: uma linha por tipo de encontro que ela
 * deveria frequentar (igreja toda + ministérios atuais) ou em que tem registro.
 */
export async function personAttendanceMatrix(personId: string, weeks = 12) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayIso(tz);
  const weekStarts = Array.from({ length: weeks }, (_, k) => addDaysIso(today, -(weeks - 1 - k) * 7 - 6));
  const bounds = weekStarts.map((w) => startOfDayUtc(w, tz).getTime());
  const now = new Date();

  const [memberships, person, events, records] = await Promise.all([
    db
      .select({ ministryId: schema.membership.ministryId, start: schema.membership.startDate, end: schema.membership.endDate })
      .from(schema.membership)
      .where(eq(schema.membership.personId, personId)),
    db.query.person.findFirst({
      where: eq(schema.person.id, personId),
      columns: { createdAt: true, firstVisitDate: true, memberSince: true },
    }),
    db.query.event.findMany({
      where: and(gte(schema.event.startsAt, new Date(bounds[0])), lt(schema.event.startsAt, now), eq(schema.event.cancelled, false)),
      with: { audience: true, series: true, category: true },
      orderBy: schema.event.startsAt,
    }),
    db
      .select({ eventId: schema.attendance.eventId, status: schema.attendance.status })
      .from(schema.attendance)
      .innerJoin(schema.event, eq(schema.event.id, schema.attendance.eventId))
      .where(and(eq(schema.attendance.personId, personId), gte(schema.event.startsAt, new Date(bounds[0])))),
  ]);
  // A pessoa só "deveria" estar em encontros a partir de quando chegou à igreja, e nos de
  // ministério só enquanto participava dele.
  const arrived = [person?.firstVisitDate, person?.memberSince, person ? isoDateInTz(person.createdAt, tz) : null]
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const memberOn = (ministryId: string, date: string) =>
    memberships.some((m) => m.ministryId === ministryId && m.start <= date && (!m.end || date <= m.end));
  const launchedRows = events.length
    ? await db
        .select({ eventId: schema.attendance.eventId, n: sql<number>`count(*)` })
        .from(schema.attendance)
        .where(inArray(schema.attendance.eventId, events.map((e) => e.id)))
        .groupBy(schema.attendance.eventId)
    : [];
  const launched = new Set(launchedRows.map((r) => r.eventId));
  const statusByEvent = new Map(records.map((r) => [r.eventId, r.status]));

  const rows = new Map<string, MatrixRow & { order: number }>();
  for (const ev of events) {
    const date = isoDateInTz(ev.startsAt, tz);
    const forEveryone = ev.audience.length === 0 && (!arrived || date >= arrived);
    const forMe = ev.audience.some((a) => memberOn(a.ministryId, date));
    if (!forEveryone && !forMe && !statusByEvent.has(ev.id)) continue;

    const key = ev.seriesId ?? "special";
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        label: ev.series?.title ?? "Eventos especiais",
        color: ev.category?.color ?? "ember",
        weeks: weekStarts.map(() => []),
        // Igreja toda primeiro, depois ministérios, depois eventos avulsos.
        order: ev.seriesId ? (ev.audience.length === 0 ? 0 : 1) : 2,
      });
    }
    const t = ev.startsAt.getTime();
    let w = bounds.length - 1;
    while (w > 0 && t < bounds[w]) w--;
    rows.get(key)!.weeks[w].push({ eventId: ev.id, title: ev.title, startsAt: ev.startsAt, status: statusByEvent.get(ev.id) ?? (launched.has(ev.id) ? "missed" : "unknown") });
  }

  const list = [...rows.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"));
  // Encontros sem chamada lançada não entram na taxa.
  const cells = list.flatMap((r) => r.weeks.flat()).filter((c) => c.status !== "unknown");
  const present = cells.filter((c) => c.status === "present").length;

  // Sequência: semanas seguidas (da mais recente para trás) com ao menos uma presença.
  let streak = 0;
  for (let w = weeks - 1; w >= 0; w--) {
    const week = list.flatMap((r) => r.weeks[w]).filter((c) => c.status !== "unknown");
    if (!week.length) continue;
    if (week.some((c) => c.status === "present")) streak++;
    // Semana corrente ainda em andamento não quebra a sequência.
    else if (w < weeks - 1) break;
  }
  const lastPresent = cells.filter((c) => c.status === "present").sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0] ?? null;

  return {
    weekStarts,
    rows: list.map(({ order: _order, ...r }) => r),
    stats: {
      expected: cells.length,
      present,
      rate: cells.length ? present / cells.length : null,
      streak,
      lastPresent: lastPresent ? { title: lastPresent.title, date: isoDateInTz(lastPresent.startsAt, tz) } : null,
    },
    tz,
  };
}
