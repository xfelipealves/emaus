import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { GENDERS, HOUSEHOLD_ROLES, PERSON_STATUSES, type PersonStatus } from "@/db/schema";
import { ageFrom, diffDaysIso, isoDateInTz, todayIso } from "@/lib/dates";
import { STATUS_LABEL } from "@/lib/labels";
import { normalizePhone, normalizeSearch } from "@/lib/text";
import { recordAudit, recordTimeline } from "./history";
import { getHousehold } from "./households";
import { ActionError, assertCanSeePerson, type CurrentUser, visiblePersonIds } from "./session";
import { getSettings } from "./settings";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .optional();

export const personInput = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo").max(120),
  preferredName: z.string().trim().max(60).optional(),
  status: z.enum(PERSON_STATUSES).default("visitor"),
  gender: z.enum(GENDERS).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.email("E-mail inválido").optional(),
  birthDate: isoDate,
  address: z.string().trim().max(200).optional(),
  firstVisitDate: isoDate,
  memberSince: isoDate,
  howFound: z.string().trim().max(120).optional(),
  householdId: z.string().optional(),
  householdRole: z.enum(HOUSEHOLD_ROLES).optional(),
});
export type PersonInput = z.input<typeof personInput>;

/** Subconsulta: última presença e total de presenças por pessoa. */
function presenceStats() {
  return db
    .select({
      personId: schema.attendance.personId,
      lastSeen: sql<number | null>`max(${schema.event.startsAt})`.as("last_seen"),
      visits: sql<number>`count(*)`.as("visits"),
    })
    .from(schema.attendance)
    .innerJoin(schema.event, eq(schema.event.id, schema.attendance.eventId))
    // Só presença efetiva: encontro realizado e não cancelado.
    .where(
      and(
        eq(schema.attendance.status, "present"),
        eq(schema.event.cancelled, false),
        lte(schema.event.startsAt, sql`(unixepoch() * 1000)`),
      ),
    )
    .groupBy(schema.attendance.personId)
    .as("presence");
}

export type PeopleFilter = {
  q?: string;
  status?: PersonStatus | "all";
  ministryId?: string;
  householdId?: string;
};

/** Lista completa memoizada por request: layout, painel e cuidado usam a mesma. */
const listAllPeople = cache((user: CurrentUser) => queryPeople(user, {}));

export async function listPeople(user: CurrentUser, filter: PeopleFilter = {}) {
  const hasFilter = Object.values(filter).some((v) => v !== undefined && v !== "all" && v !== "");
  return hasFilter ? queryPeople(user, filter) : listAllPeople(user);
}

async function queryPeople(user: CurrentUser, filter: PeopleFilter) {
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const visible = await visiblePersonIds(user);
  const presence = presenceStats();

  const where = [];
  if (visible) where.push(inArray(schema.person.id, [...visible]));
  if (filter.status && filter.status !== "all") {
    where.push(eq(schema.person.status, filter.status));
  }
  if (filter.householdId) where.push(eq(schema.person.householdId, filter.householdId));
  if (filter.ministryId) {
    where.push(
      inArray(
        schema.person.id,
        db
          .select({ id: schema.membership.personId })
          .from(schema.membership)
          .where(
            and(
              eq(schema.membership.ministryId, filter.ministryId),
              isNull(schema.membership.endDate),
            ),
          ),
      ),
    );
  }
  const rows = await db
    .select({
      person: schema.person,
      householdName: schema.household.name,
      lastSeen: presence.lastSeen,
      visits: presence.visits,
    })
    .from(schema.person)
    .leftJoin(presence, eq(presence.personId, schema.person.id))
    .leftJoin(schema.household, eq(schema.household.id, schema.person.householdId))
    .where(and(...where))
    .orderBy(asc(sql`lower(${schema.person.fullName})`));

  // Busca em memória: SQLite não ignora acentos e a base é pequena.
  const q = filter.q?.trim();
  const needle = q ? normalizeSearch(q) : null;
  const digits = q ? normalizePhone(q) : "";
  const all = needle
    ? rows.filter(
        (r) =>
          normalizeSearch(r.person.fullName).includes(needle) ||
          normalizeSearch(r.person.preferredName ?? "").includes(needle) ||
          (digits.length >= 3 && (r.person.phoneDigits ?? "").includes(digits)),
      )
    : rows;

  const ids = all.map((r) => r.person.id);
  const memberships = ids.length
    ? await db
        .select({
          personId: schema.membership.personId,
          role: schema.membership.role,
          ministryId: schema.ministry.id,
          name: schema.ministry.name,
          color: schema.ministry.color,
        })
        .from(schema.membership)
        .innerJoin(schema.ministry, eq(schema.ministry.id, schema.membership.ministryId))
        .where(and(inArray(schema.membership.personId, ids), isNull(schema.membership.endDate)))
    : [];
  const byPerson = Map.groupBy(memberships, (m) => m.personId);

  return all
    .map((r) => {
      const lastSeenDate = r.lastSeen ? isoDateInTz(new Date(r.lastSeen), settings.timezone) : null;
      return {
        ...r.person,
        householdName: r.householdName,
        age: ageFrom(r.person.birthDate, today),
        visits: r.visits ?? 0,
        lastSeen: r.lastSeen ? new Date(r.lastSeen) : null,
        daysSinceSeen: lastSeenDate ? diffDaysIso(today, lastSeenDate) : null,
        ministries: (byPerson.get(r.person.id) ?? []).map(({ personId: _personId, ...m }) => m),
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

export async function peopleCounts(user: CurrentUser) {
  const visible = await visiblePersonIds(user);
  const rows = await db
    .select({ status: schema.person.status, count: sql<number>`count(*)` })
    .from(schema.person)
    .where(visible ? inArray(schema.person.id, [...visible]) : undefined)
    .groupBy(schema.person.status);
  const counts = { all: 0, visitor: 0, member: 0, inactive: 0 };
  for (const r of rows) {
    counts[r.status] = r.count;
    counts.all += r.count;
  }
  return counts;
}

export async function getPerson(user: CurrentUser, id: string) {
  const visible = await visiblePersonIds(user);
  if (visible && !visible.has(id)) return null;
  const row = await db.query.person.findFirst({
    where: eq(schema.person.id, id),
    with: {
      household: {
        with: {
          members: { columns: { id: true, fullName: true, preferredName: true, status: true, householdRole: true } },
        },
      },
      memberships: {
        with: { ministry: true },
        orderBy: desc(schema.membership.startDate),
      },
    },
  });
  if (!row) return null;
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  // Familiares fora do escopo do líder não aparecem.
  const household = row.household && visible
    ? { ...row.household, members: row.household.members.filter((m) => visible.has(m.id)) }
    : row.household;
  return { ...row, household, age: ageFrom(row.birthDate, today) };
}

export async function personAttendance(personId: string, limit = 60) {
  return db
    .select({
      eventId: schema.event.id,
      title: schema.event.title,
      startsAt: schema.event.startsAt,
      status: schema.attendance.status,
      method: schema.attendance.method,
      categoryName: schema.eventCategory.name,
      categoryColor: schema.eventCategory.color,
    })
    .from(schema.attendance)
    .innerJoin(schema.event, eq(schema.event.id, schema.attendance.eventId))
    .leftJoin(schema.eventCategory, eq(schema.eventCategory.id, schema.event.categoryId))
    .where(eq(schema.attendance.personId, personId))
    .orderBy(desc(schema.event.startsAt))
    .limit(limit);
}

export async function personTimeline(personId: string, includePastoral: boolean) {
  const [events, notes, attendances] = await Promise.all([
    db.query.timelineEvent.findMany({
      where: eq(schema.timelineEvent.personId, personId),
      with: { actor: { columns: { name: true } } },
      orderBy: desc(schema.timelineEvent.occurredAt),
      limit: 200,
    }),
    db.query.note.findMany({
      where: and(
        eq(schema.note.personId, personId),
        includePastoral ? undefined : eq(schema.note.visibility, "team"),
      ),
      with: { author: { columns: { name: true } } },
      orderBy: [desc(schema.note.pinned), desc(schema.note.createdAt)],
    }),
    personAttendance(personId, 100),
  ]);

  type Item =
    | { type: "event"; at: Date; id: string; kind: string; title: string; detail: string | null; actor: string | null }
    | { type: "note"; at: Date; id: string; content: string; pinned: boolean; pastoral: boolean; author: string | null; authorId: string | null; editedAt: Date | null }
    | { type: "attendance"; at: Date; id: string; title: string; status: "present" | "absent"; color: string | null };

  const items: Item[] = [
    ...events.map((e) => ({
      type: "event" as const,
      at: e.occurredAt,
      id: e.id,
      kind: e.kind,
      title: e.title,
      detail: e.detail,
      actor: e.actor?.name ?? null,
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      at: n.createdAt,
      id: n.id,
      content: n.content,
      pinned: n.pinned,
      pastoral: n.visibility === "pastoral",
      author: n.author?.name ?? null,
      authorId: n.authorId,
      editedAt: n.editedAt,
    })),
    ...attendances.map((a) => ({
      type: "attendance" as const,
      at: a.startsAt,
      id: a.eventId,
      title: a.title,
      status: a.status,
      color: a.categoryColor,
    })),
  ];
  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return { items, pinned: notes.filter((n) => n.pinned) };
}

function toRow(input: z.output<typeof personInput>) {
  return {
    fullName: input.fullName,
    preferredName: input.preferredName ?? null,
    status: input.status,
    gender: input.gender ?? null,
    phone: input.phone ?? null,
    phoneDigits: input.phone ? normalizePhone(input.phone) || null : null,
    email: input.email ?? null,
    birthDate: input.birthDate ?? null,
    address: input.address ?? null,
    firstVisitDate: input.firstVisitDate ?? null,
    memberSince: input.memberSince ?? null,
    howFound: input.howFound ?? null,
    householdId: input.householdId ?? null,
    householdRole: input.householdId ? (input.householdRole ?? "other") : null,
  };
}

export async function createPerson(user: CurrentUser, raw: unknown) {
  const input = personInput.parse(raw);
  const settings = await getSettings();
  const row = toRow(input);
  if (row.status === "visitor" && !row.firstVisitDate) {
    row.firstVisitDate = todayIso(settings.timezone);
  }
  if (row.status === "member" && !row.memberSince) {
    row.memberSince = todayIso(settings.timezone);
  }
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.person).values(row).returning();
    await recordTimeline(tx, {
      personId: created.id,
      actorId: user.id,
      kind: "registered",
      title: `Cadastrado como ${STATUS_LABEL[created.status].toLowerCase()}`,
    });
    // Líder cadastra dentro do próprio escopo: já entra no primeiro ministério liberado.
    if (user.ministryIds?.length) {
      await tx.insert(schema.membership).values({
        personId: created.id,
        ministryId: user.ministryIds[0],
        startDate: todayIso(settings.timezone),
      });
    }
    return created;
  });
}

export async function updatePerson(user: CurrentUser, id: string, raw: unknown) {
  await assertCanSeePerson(user, id);
  const input = personInput.parse(raw);
  const before = await db.query.person.findFirst({ where: eq(schema.person.id, id) });
  if (!before) throw new ActionError("Pessoa não encontrada.");
  const row = toRow(input);
  // Status muda por changeStatus, que registra o histórico.
  const { status: _status, ...rest } = row;
  if (user.ministryIds && rest.householdId && rest.householdId !== before.householdId && !(await getHousehold(user, rest.householdId))) {
    throw new ActionError("Família não encontrada.");
  }
  await db.transaction(async (tx) => {
    await tx.update(schema.person).set(rest).where(eq(schema.person.id, id));
    if (before.householdId !== rest.householdId && rest.householdId) {
      const house = await tx.query.household.findFirst({
        where: eq(schema.household.id, rest.householdId),
      });
      await recordTimeline(tx, {
        personId: id,
        actorId: user.id,
        kind: "household",
        title: `Entrou na família ${house?.name ?? ""}`.trim(),
      });
    }
  });
  if (input.status !== before.status) await changeStatus(user, id, input.status);
}

export async function changeStatus(
  user: CurrentUser,
  id: string,
  status: PersonStatus,
  reason?: string,
) {
  await assertCanSeePerson(user, id);
  const settings = await getSettings();
  const before = await db.query.person.findFirst({ where: eq(schema.person.id, id) });
  if (!before) throw new ActionError("Pessoa não encontrada.");
  if (before.status === status) return;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.person)
      .set({
        status,
        statusChangedAt: new Date(),
        memberSince:
          status === "member" && !before.memberSince
            ? todayIso(settings.timezone)
            : before.memberSince,
      })
      .where(eq(schema.person.id, id));
    await recordTimeline(tx, {
      personId: id,
      actorId: user.id,
      kind: "status",
      title: `${STATUS_LABEL[before.status]} → ${STATUS_LABEL[status]}`,
      detail: reason ?? null,
    });
    await recordAudit(tx, {
      actorId: user.id,
      entity: "person",
      entityId: id,
      action: "status.change",
      summary: `${before.fullName}: ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[status]}`,
      before: { status: before.status },
      after: { status, reason },
    });
  });
}

export async function deletePerson(user: CurrentUser, id: string) {
  const before = await db.query.person.findFirst({ where: eq(schema.person.id, id) });
  if (!before) throw new ActionError("Pessoa não encontrada.");
  await db.transaction(async (tx) => {
    await tx.update(schema.user).set({ personId: null }).where(eq(schema.user.personId, id));
    await tx.delete(schema.person).where(eq(schema.person.id, id));
    await recordAudit(tx, {
      actorId: user.id,
      entity: "person",
      entityId: id,
      action: "delete",
      summary: `Cadastro de ${before.fullName} excluído`,
      before,
    });
  });
}

/** Pessoas ativas sem presença há mais que o limite de cuidado. */
export async function peopleNeedingCare(user: CurrentUser) {
  const settings = await getSettings();
  const people = await listPeople(user);
  const today = todayIso(settings.timezone);
  const openFollowUps = await db
    .select({ personId: schema.followUp.personId })
    .from(schema.followUp)
    .where(isNull(schema.followUp.doneAt));
  const withFollowUp = new Set(openFollowUps.map((f) => f.personId));

  return people
    .filter((p) => p.status !== "inactive")
    .map((p) => {
      // Sem presença: conta desde a primeira visita (ou desde o cadastro).
      const since =
        p.daysSinceSeen ??
        diffDaysIso(today, p.firstVisitDate ?? isoDateInTz(p.createdAt, settings.timezone));
      return { ...p, absentDays: since, neverSeen: p.lastSeen === null, hasFollowUp: withFollowUp.has(p.id) };
    })
    .filter((p) => p.absentDays >= settings.careThresholdDays)
    .sort((a, b) => Number(a.hasFollowUp) - Number(b.hasFollowUp) || b.absentDays - a.absentDays);
}
