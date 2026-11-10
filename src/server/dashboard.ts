import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysIso, daysUntilBirthday, startOfDayUtc, todayIso } from "@/lib/dates";
import { weekBuckets } from "./ministries";
import { listPeople, peopleNeedingCare } from "./people";
import { type CurrentUser, visiblePersonIds } from "./session";
import { getSettings } from "./settings";

export async function dashboardData(user: CurrentUser) {
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayIso(tz);
  const visible = await visiblePersonIds(user);
  const people = await listPeople(user);
  const active = people.filter((p) => p.status !== "inactive");

  const weeks = 12;
  const from = startOfDayUtc(addDaysIso(today, -weeks * 7 + 1), tz);
  const presence = await db
    .select({ startsAt: schema.event.startsAt, personId: schema.attendance.personId })
    .from(schema.attendance)
    .innerJoin(schema.event, eq(schema.event.id, schema.attendance.eventId))
    .where(
      and(
        eq(schema.attendance.status, "present"),
        eq(schema.event.cancelled, false),
        gte(schema.event.startsAt, from),
        lt(schema.event.startsAt, new Date()),
        visible ? inArray(schema.attendance.personId, [...visible]) : undefined,
      ),
    );

  const statusById = new Map(people.map((p) => [p.id, p.status]));
  const trend = weekBuckets(presence, today, weeks, tz).map(({ week, people }) => {
    let visitors = 0;
    for (const id of people) if (statusById.get(id) === "visitor") visitors++;
    return { week, members: people.size - visitors, visitors, total: people.size };
  });

  const last4 = trend.slice(-4);
  const prev4 = trend.slice(-8, -4);
  const avg = (xs: typeof trend) => (xs.length ? xs.reduce((s, x) => s + x.total, 0) / xs.length : 0);
  const avgNow = avg(last4);
  const avgPrev = avg(prev4);

  const thirtyAgo = addDaysIso(today, -30);
  const newVisitors = people
    .filter((p) => p.firstVisitDate && p.firstVisitDate >= thirtyAgo)
    .sort((a, b) => (b.firstVisitDate ?? "").localeCompare(a.firstVisitDate ?? ""));
  const returningVisitors = newVisitors.filter((p) => p.visits >= 2).length;

  const birthdays = active
    .filter((p) => p.birthDate)
    .map((p) => ({ ...p, inDays: daysUntilBirthday(p.birthDate!, today) }))
    .filter((p) => p.inDays <= 14)
    .sort((a, b) => a.inDays - b.inDays);

  const care = await peopleNeedingCare(user);

  const [openFollowUps] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.followUp)
    .where(and(sql`${schema.followUp.doneAt} is null`, eq(schema.followUp.assigneeId, user.id)));

  return {
    settings,
    today,
    counts: {
      active: active.length,
      members: people.filter((p) => p.status === "member").length,
      visitors: people.filter((p) => p.status === "visitor").length,
      newVisitors: newVisitors.length,
      returningVisitors,
      myFollowUps: openFollowUps?.n ?? 0,
    },
    attendance: {
      avgNow: Math.round(avgNow),
      delta: avgPrev ? (avgNow - avgPrev) / avgPrev : null,
      engagement: active.length ? last4.length && avgNow / active.length : 0,
    },
    trend,
    newVisitors: newVisitors.slice(0, 6),
    birthdays: birthdays.slice(0, 8),
    care: care.slice(0, 8),
    careTotal: care.length,
  };
}
