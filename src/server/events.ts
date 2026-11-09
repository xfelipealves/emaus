import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { RECURRENCES } from "@/db/schema";
import { addDaysIso, formatDate, isoDateInTz, todayIso, zonedToUtc } from "@/lib/dates";
import { TONES } from "@/lib/labels";
import { occurrences } from "@/lib/recurrence";
import { normalizePhone } from "@/lib/text";
import { recordAudit, recordTimeline } from "./history";
import { ActionError, type CurrentUser, visiblePersonIds } from "./session";
import { getSettings } from "./settings";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida");

export const eventInput = z.object({
  title: z.string().trim().min(2, "Informe o título").max(120),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().optional(),
  date: isoDate,
  time,
  durationMinutes: z.coerce.number().int().min(15).max(24 * 60).default(120),
  location: z.string().trim().max(120).optional(),
  ministryIds: z.array(z.string()).default([]),
  recurrence: z.enum([...RECURRENCES, "none"]).default("none"),
  until: isoDate.optional(),
});

export const categoryInput = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(60),
  color: z.enum(TONES).default("ember"),
});

/** Quantas semanas à frente uma série gera encontros automaticamente. */
const SERIES_HORIZON_DAYS = 7 * 12;

function eventScope(user: CurrentUser) {
  if (!user.ministryIds) return undefined;
  // Líder vê encontros da igreja toda e dos seus ministérios.
  const audience = db
    .select({ id: schema.eventMinistry.eventId })
    .from(schema.eventMinistry);
  const mine = user.ministryIds.length
    ? db
        .select({ id: schema.eventMinistry.eventId })
        .from(schema.eventMinistry)
        .where(inArray(schema.eventMinistry.ministryId, user.ministryIds))
    : null;
  return mine
    ? sql`(${schema.event.id} not in ${audience} or ${schema.event.id} in ${mine})`
    : sql`${schema.event.id} not in ${audience}`;
}

export async function listEvents(user: CurrentUser, range: { from: Date; to: Date }) {
  const events = await db.query.event.findMany({
    where: and(
      gte(schema.event.startsAt, range.from),
      lt(schema.event.startsAt, range.to),
      eventScope(user),
    ),
    orderBy: asc(schema.event.startsAt),
    with: {
      category: true,
      audience: { with: { ministry: { columns: { id: true, name: true, color: true } } } },
    },
  });
  const counts = await attendanceCounts(events.map((e) => e.id));
  return events.map((e) => ({ ...e, present: counts.get(e.id) ?? 0 }));
}

async function attendanceCounts(eventIds: string[]) {
  if (!eventIds.length) return new Map<string, number>();
  const rows = await db
    .select({ eventId: schema.attendance.eventId, n: sql<number>`count(*)` })
    .from(schema.attendance)
    .where(and(inArray(schema.attendance.eventId, eventIds), eq(schema.attendance.status, "present")))
    .groupBy(schema.attendance.eventId);
  return new Map(rows.map((r) => [r.eventId, r.n]));
}

export async function upcomingEvents(user: CurrentUser, limit = 5) {
  const now = new Date();
  const from = new Date(now.getTime() - 3 * 3600_000);
  const rows = await listEvents(user, { from, to: new Date(now.getTime() + 60 * 86_400_000) });
  return rows.filter((e) => !e.cancelled).slice(0, limit);
}

export async function recentEvents(user: CurrentUser, limit = 8) {
  const now = new Date();
  const rows = await listEvents(user, { from: new Date(now.getTime() - 120 * 86_400_000), to: now });
  return rows.filter((e) => !e.cancelled).reverse().slice(0, limit);
}

export async function getEvent(user: CurrentUser, id: string) {
  const row = await db.query.event.findFirst({
    where: and(eq(schema.event.id, id), eventScope(user)),
    with: {
      category: true,
      series: true,
      audience: { with: { ministry: true } },
    },
  });
  return row ?? null;
}

export async function getEventByToken(token: string) {
  const row = await db.query.event.findFirst({
    where: eq(schema.event.checkinToken, token),
    with: { category: true },
  });
  return row ?? null;
}

/**
 * Lista de presença: público do encontro + quem já tem registro.
 * Inativos só aparecem se já tiverem registro neste encontro.
 */
export async function attendanceRoster(user: CurrentUser, eventId: string) {
  const ev = await db.query.event.findFirst({
    where: eq(schema.event.id, eventId),
    with: { audience: true },
  });
  if (!ev) throw new ActionError("Encontro não encontrado.");
  const audienceIds = ev.audience.map((a) => a.ministryId);
  const visible = await visiblePersonIds(user);

  const records = await db
    .select()
    .from(schema.attendance)
    .where(eq(schema.attendance.eventId, eventId));
  const byPerson = new Map(records.map((r) => [r.personId, r]));

  let eligible: string[] | null = null;
  if (audienceIds.length) {
    eligible = (
      await db
        .selectDistinct({ id: schema.membership.personId })
        .from(schema.membership)
        .where(
          and(
            inArray(schema.membership.ministryId, audienceIds),
            sql`${schema.membership.endDate} is null`,
          ),
        )
    ).map((r) => r.id);
  }

  const people = await db
    .select({
      id: schema.person.id,
      fullName: schema.person.fullName,
      preferredName: schema.person.preferredName,
      status: schema.person.status,
      phone: schema.person.phone,
      birthDate: schema.person.birthDate,
      householdId: schema.person.householdId,
    })
    .from(schema.person)
    .where(ne(schema.person.status, "inactive"))
    .orderBy(asc(sql`lower(${schema.person.fullName})`));

  const extraIds = records.map((r) => r.personId).filter((id) => !people.some((p) => p.id === id));
  const extras = extraIds.length
    ? await db
        .select({
          id: schema.person.id,
          fullName: schema.person.fullName,
          preferredName: schema.person.preferredName,
          status: schema.person.status,
          phone: schema.person.phone,
          birthDate: schema.person.birthDate,
          householdId: schema.person.householdId,
        })
        .from(schema.person)
        .where(inArray(schema.person.id, extraIds))
    : [];

  const eligibleSet = eligible ? new Set(eligible) : null;
  return [...people, ...extras]
    .filter((p) => byPerson.has(p.id) || !eligibleSet || eligibleSet.has(p.id))
    .filter((p) => !visible || visible.has(p.id) || byPerson.has(p.id))
    .map((p) => {
      const rec = byPerson.get(p.id);
      return {
        ...p,
        attendance: rec?.status ?? null,
        method: rec?.method ?? null,
        recordedAt: rec?.updatedAt ?? null,
        inAudience: !eligibleSet || eligibleSet.has(p.id),
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

export async function setAttendance(
  user: CurrentUser | null,
  eventId: string,
  personId: string,
  status: "present" | "absent" | null,
  method: "manual" | "kiosk" | "qr" = "manual",
) {
  if (user) {
    const visible = await visiblePersonIds(user);
    if (visible && !visible.has(personId)) {
      throw new ActionError("Você não tem acesso a esta pessoa.");
    }
  }
  const ev = await db.query.event.findFirst({ where: eq(schema.event.id, eventId) });
  if (!ev) throw new ActionError("Encontro não encontrado.");
  if (ev.cancelled) throw new ActionError("Este encontro foi cancelado.");

  await db.transaction(async (tx) => {
    const existing = await tx.query.attendance.findFirst({
      where: and(eq(schema.attendance.eventId, eventId), eq(schema.attendance.personId, personId)),
      with: { person: { columns: { fullName: true } } },
    });
    if ((existing?.status ?? null) === status) return;

    if (status === null) {
      await tx.delete(schema.attendance).where(eq(schema.attendance.id, existing!.id));
    } else if (existing) {
      await tx
        .update(schema.attendance)
        .set({ status, method, recordedById: user?.id ?? null })
        .where(eq(schema.attendance.id, existing.id));
    } else {
      await tx.insert(schema.attendance).values({
        eventId,
        personId,
        status,
        method,
        recordedById: user?.id ?? null,
      });
    }

    // Correção = mudança sobre um registro já lançado (RN-011).
    if (existing) {
      const label = { present: "presente", absent: "ausente" } as const;
      await recordAudit(tx, {
        actorId: user?.id ?? null,
        entity: "attendance",
        entityId: eventId,
        action: "attendance.correct",
        summary: `${existing.person.fullName} em "${ev.title}": ${label[existing.status]} → ${status ? label[status] : "sem registro"}`,
        before: { status: existing.status, method: existing.method },
        after: { status, method },
      });
    }
  });
}

export async function markAllAbsent(user: CurrentUser, eventId: string) {
  const roster = await attendanceRoster(user, eventId);
  const pending = roster.filter((p) => p.attendance === null && p.inAudience);
  if (!pending.length) return 0;
  await db.insert(schema.attendance).values(
    pending.map((p) => ({ eventId, personId: p.id, status: "absent" as const, recordedById: user.id })),
  );
  return pending.length;
}

export async function addQuickVisitor(
  user: CurrentUser | null,
  eventId: string,
  input: { fullName: string; phone?: string },
  method: "manual" | "kiosk" | "qr" = "manual",
) {
  const name = input.fullName.trim();
  if (name.length < 2) throw new ActionError("Informe o nome do visitante.");
  const settings = await getSettings();
  const ev = await db.query.event.findFirst({ where: eq(schema.event.id, eventId) });
  if (!ev) throw new ActionError("Encontro não encontrado.");
  const digits = input.phone ? normalizePhone(input.phone) : "";

  const person = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.person)
      .values({
        fullName: name,
        status: "visitor",
        phone: input.phone?.trim() || null,
        phoneDigits: digits || null,
        firstVisitDate: isoDateInTz(ev.startsAt, settings.timezone),
      })
      .returning();
    await recordTimeline(tx, {
      personId: created.id,
      actorId: user?.id ?? null,
      kind: "registered",
      title: `Primeira visita em ${ev.title}`,
      detail: method === "qr" ? "Cadastro feito pelo próprio visitante via QR Code" : null,
    });
    await tx.insert(schema.attendance).values({
      eventId,
      personId: created.id,
      status: "present",
      method,
      recordedById: user?.id ?? null,
    });
    // Visitante cadastrado por líder entra no ministério dele para continuar visível.
    if (user?.ministryIds?.length) {
      await tx.insert(schema.membership).values({
        personId: created.id,
        ministryId: user.ministryIds[0],
        startDate: todayIso(settings.timezone),
      });
    }
    return created;
  });
  return person;
}

async function insertOccurrence(
  input: z.output<typeof eventInput>,
  date: string,
  timeZone: string,
  seriesId: string | null,
) {
  const startsAt = zonedToUtc(date, input.time, timeZone);
  const [ev] = await db
    .insert(schema.event)
    .values({
      title: input.title,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      seriesId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + input.durationMinutes * 60_000),
      location: input.location ?? null,
    })
    .returning();
  if (input.ministryIds.length) {
    await db
      .insert(schema.eventMinistry)
      .values(input.ministryIds.map((ministryId) => ({ eventId: ev.id, ministryId })));
  }
  return ev;
}

export async function createEvent(user: CurrentUser, raw: unknown) {
  const input = eventInput.parse(raw);
  const settings = await getSettings();
  if (input.recurrence === "none") {
    return insertOccurrence(input, input.date, settings.timezone, null);
  }
  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  const [series] = await db
    .insert(schema.eventSeries)
    .values({
      title: input.title,
      categoryId: input.categoryId ?? null,
      recurrence: input.recurrence,
      weekday,
      time: input.time,
      durationMinutes: input.durationMinutes,
      location: input.location ?? null,
      startDate: input.date,
      endDate: input.until ?? null,
      ministryIds: input.ministryIds,
    })
    .returning();
  const dates = occurrences({
    recurrence: input.recurrence,
    weekday,
    startDate: input.date,
    from: input.date,
    until: minIso(input.until, addDaysIso(input.date, SERIES_HORIZON_DAYS)),
  });
  let first: typeof schema.event.$inferSelect | null = null;
  for (const date of dates) {
    const ev = await insertOccurrence(input, date, settings.timezone, series.id);
    first ??= ev;
  }
  await recordAudit(db, {
    actorId: user.id,
    entity: "series",
    entityId: series.id,
    action: "create",
    summary: `Série "${series.title}" criada com ${dates.length} encontros`,
  });
  return first!;
}

function minIso(a: string | undefined, b: string) {
  return a && a < b ? a : b;
}

/** Garante encontros futuros das séries ativas (executado ao abrir a agenda). */
export async function extendSeries() {
  const settings = await getSettings();
  const today = todayIso(settings.timezone);
  const horizon = addDaysIso(today, SERIES_HORIZON_DAYS);
  const series = await db.query.eventSeries.findMany();
  for (const s of series) {
    if (s.endDate && s.endDate < today) continue;
    const last = await db.query.event.findFirst({
      where: eq(schema.event.seriesId, s.id),
      orderBy: desc(schema.event.startsAt),
    });
    const from = last ? addDaysIso(isoDateInTz(last.startsAt, settings.timezone), 1) : s.startDate;
    const dates = occurrences({
      recurrence: s.recurrence,
      weekday: s.weekday,
      startDate: s.startDate,
      from,
      until: minIso(s.endDate ?? undefined, horizon),
    });
    for (const date of dates) {
      await insertOccurrence(
        {
          title: s.title,
          categoryId: s.categoryId ?? undefined,
          date,
          time: s.time,
          durationMinutes: s.durationMinutes,
          location: s.location ?? undefined,
          ministryIds: s.ministryIds,
          recurrence: "none",
        },
        date,
        settings.timezone,
        s.id,
      );
    }
  }
}

export async function updateEvent(user: CurrentUser, id: string, raw: unknown) {
  const input = eventInput.parse(raw);
  const settings = await getSettings();
  const startsAt = zonedToUtc(input.date, input.time, settings.timezone);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.event)
      .set({
        title: input.title,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        startsAt,
        endsAt: new Date(startsAt.getTime() + input.durationMinutes * 60_000),
        location: input.location ?? null,
      })
      .where(eq(schema.event.id, id));
    await tx.delete(schema.eventMinistry).where(eq(schema.eventMinistry.eventId, id));
    if (input.ministryIds.length) {
      await tx
        .insert(schema.eventMinistry)
        .values(input.ministryIds.map((ministryId) => ({ eventId: id, ministryId })));
    }
  });
}

export async function setEventCancelled(user: CurrentUser, id: string, cancelled: boolean) {
  const ev = await db.query.event.findFirst({ where: eq(schema.event.id, id) });
  if (!ev) throw new ActionError("Encontro não encontrado.");
  await db.update(schema.event).set({ cancelled, checkinOpen: false }).where(eq(schema.event.id, id));
  await recordAudit(db, {
    actorId: user.id,
    entity: "event",
    entityId: id,
    action: cancelled ? "cancel" : "restore",
    summary: `Encontro "${ev.title}" de ${formatDate(ev.startsAt)} ${cancelled ? "cancelado" : "reativado"}`,
  });
}

export async function deleteEvent(user: CurrentUser, id: string, scope: "one" | "future" = "one") {
  const ev = await db.query.event.findFirst({ where: eq(schema.event.id, id) });
  if (!ev) throw new ActionError("Encontro não encontrado.");
  await db.transaction(async (tx) => {
    if (scope === "future" && ev.seriesId) {
      await tx
        .delete(schema.event)
        .where(and(eq(schema.event.seriesId, ev.seriesId), gte(schema.event.startsAt, ev.startsAt)));
      const settings = await getSettings();
      await tx
        .update(schema.eventSeries)
        .set({ endDate: addDaysIso(isoDateInTz(ev.startsAt, settings.timezone), -1) })
        .where(eq(schema.eventSeries.id, ev.seriesId));
    } else {
      await tx.delete(schema.event).where(eq(schema.event.id, id));
    }
    await recordAudit(tx, {
      actorId: user.id,
      entity: "event",
      entityId: id,
      action: "delete",
      summary:
        scope === "future"
          ? `Encontros futuros da série "${ev.title}" excluídos`
          : `Encontro "${ev.title}" de ${formatDate(ev.startsAt)} excluído`,
    });
  });
}

export async function setCheckinOpen(id: string, open: boolean) {
  await db.update(schema.event).set({ checkinOpen: open }).where(eq(schema.event.id, id));
}

/** Autoatendimento por QR: localiza pelo telefone e marca presença. */
export async function selfCheckin(token: string, phone: string) {
  const ev = await getEventByToken(token);
  if (!ev || !ev.checkinOpen || ev.cancelled) {
    throw new ActionError("O check-in deste encontro não está aberto.");
  }
  const digits = normalizePhone(phone);
  if (digits.length < 10) throw new ActionError("Informe o celular com DDD.");
  const matches = await db
    .select({ id: schema.person.id, fullName: schema.person.fullName, preferredName: schema.person.preferredName })
    .from(schema.person)
    .where(eq(schema.person.phoneDigits, digits));
  if (!matches.length) {
    const settings = await getSettings();
    return { found: false as const, allowRegister: settings.allowSelfRegistration };
  }
  for (const p of matches) await setAttendance(null, ev.id, p.id, "present", "qr");
  return {
    found: true as const,
    names: matches.map((p) => (p.preferredName || p.fullName).split(" ")[0]),
  };
}

export async function selfRegisterVisitor(token: string, fullName: string, phone: string) {
  if (!(await getSettings()).allowSelfRegistration) {
    throw new ActionError("Procure a equipe de recepção para fazer seu cadastro.");
  }
  const ev = await getEventByToken(token);
  if (!ev || !ev.checkinOpen || ev.cancelled) {
    throw new ActionError("O check-in deste encontro não está aberto.");
  }
  const digits = normalizePhone(phone);
  if (digits.length < 10) throw new ActionError("Informe o celular com DDD.");
  const existing = await db.query.person.findFirst({ where: eq(schema.person.phoneDigits, digits) });
  if (existing) {
    await setAttendance(null, ev.id, existing.id, "present", "qr");
    return existing;
  }
  return addQuickVisitor(null, ev.id, { fullName, phone }, "qr");
}

/* ───────────── Categorias ───────────── */

export async function listCategories() {
  return db.query.eventCategory.findMany({ orderBy: asc(schema.eventCategory.name) });
}

export async function saveCategory(id: string | null, raw: unknown) {
  const input = categoryInput.parse(raw);
  if (id) {
    await db.update(schema.eventCategory).set(input).where(eq(schema.eventCategory.id, id));
  } else {
    await db.insert(schema.eventCategory).values(input);
  }
}

export async function deleteCategory(id: string) {
  await db.delete(schema.eventCategory).where(eq(schema.eventCategory.id, id));
}
