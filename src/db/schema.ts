import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** Igreja (tenant) dona da linha: toda consulta a estas tabelas filtra por ela. */
const churchId = () =>
  text("church_id")
    .notNull()
    .references(() => church.id, { onDelete: "cascade" });

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date()),
};

export const ROLES = ["admin", "secretary", "leader"] as const;
export type Role = (typeof ROLES)[number];

export const PERSON_STATUSES = ["visitor", "member", "inactive"] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export const HOUSEHOLD_ROLES = ["head", "spouse", "child", "other"] as const;
export type HouseholdRole = (typeof HOUSEHOLD_ROLES)[number];

export const GENDERS = ["female", "male"] as const;

/* ───────────────────────── Better Auth ───────────────────────── */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: text("role", { enum: ROLES }).notNull().default("secretary"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** Senha definida por um administrador: precisa ser trocada no próximo acesso. */
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  personId: text("person_id").references(() => person.id, {
    onDelete: "set null",
  }),
  /** Igreja da conta; null só em contas exclusivas da plataforma. */
  churchId: text("church_id").references(() => church.id, { onDelete: "cascade" }),
  /** Opera a plataforma: vê e administra todas as igrejas em /plataforma. */
  platformAdmin: integer("platform_admin", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (t) => [index("user_church_idx").on(t.churchId)]);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
});

/* ───────────────────────── Igreja ───────────────────────── */

export const church = sqliteTable("church", {
  id: id(),
  /** Identificador curto e único, usado no painel da plataforma. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().default("Minha Igreja"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  /** Dias sem presença para alguém entrar em "precisa de cuidado". */
  careThresholdDays: integer("care_threshold_days").notNull().default(21),
  /** Visitante pode se cadastrar sozinho pelo QR de check-in. */
  allowSelfRegistration: integer("allow_self_registration", { mode: "boolean" }).notNull().default(true),
  /** Provedor de IA escolhido em Configurações → IA (null = automático pelo .env). */
  aiProvider: text("ai_provider"),
  aiModel: text("ai_model"),
  aiEffort: text("ai_effort"),
  /** Teto de gasto com IA por dia (US$), da igreja toda e de cada usuário; null = sem teto. */
  aiDailyBudgetUsd: real("ai_daily_budget_usd"),
  aiUserDailyBudgetUsd: real("ai_user_daily_budget_usd"),
  /** Desativada: ninguém da igreja entra, e os dados ficam guardados. */
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** Demonstração pública: contas compartilhadas e configuração de IA ficam travadas. */
  demo: integer("demo", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

/** Configuração da plataforma (linha única): vale para todas as igrejas. */
export const platformSettings = sqliteTable("platform_settings", {
  id: integer("id").primaryKey(),
  /** Teto de gasto com IA por dia (US$) somando todas as igrejas; null = sem teto. */
  aiDailyBudgetUsd: real("ai_daily_budget_usd"),
  ...timestamps,
});

/* ───────────────────────── Pessoas e famílias ───────────────────────── */

export const household = sqliteTable("household", {
  id: id(),
  churchId: churchId(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  ...timestamps,
}, (t) => [index("household_church_idx").on(t.churchId)]);

export const person = sqliteTable(
  "person",
  {
    id: id(),
    churchId: churchId(),
    fullName: text("full_name").notNull(),
    preferredName: text("preferred_name"),
    status: text("status", { enum: PERSON_STATUSES })
      .notNull()
      .default("visitor"),
    gender: text("gender", { enum: GENDERS }),
    phone: text("phone"),
    /** Telefone só com dígitos, usado no check-in por QR. */
    phoneDigits: text("phone_digits"),
    email: text("email"),
    /** YYYY-MM-DD */
    birthDate: text("birth_date"),
    address: text("address"),
    householdId: text("household_id").references(() => household.id, {
      onDelete: "set null",
    }),
    householdRole: text("household_role", { enum: HOUSEHOLD_ROLES }),
    /** YYYY-MM-DD */
    firstVisitDate: text("first_visit_date"),
    /** YYYY-MM-DD */
    memberSince: text("member_since"),
    howFound: text("how_found"),
    statusChangedAt: integer("status_changed_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    ...timestamps,
  },
  (t) => [
    index("person_church_status_idx").on(t.churchId, t.status),
    index("person_name_idx").on(t.fullName),
    index("person_phone_idx").on(t.phoneDigits),
    index("person_household_idx").on(t.householdId),
  ],
);

/* ───────────────────────── Ministérios ───────────────────────── */

export const ministry = sqliteTable("ministry", {
  id: id(),
  churchId: churchId(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("ember"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
}, (t) => [index("ministry_church_idx").on(t.churchId)]);

export const membership = sqliteTable(
  "membership",
  {
    id: id(),
    churchId: churchId(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    ministryId: text("ministry_id")
      .notNull()
      .references(() => ministry.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["member", "leader"] })
      .notNull()
      .default("member"),
    /** YYYY-MM-DD */
    startDate: text("start_date").notNull(),
    /** YYYY-MM-DD; null = vínculo ativo */
    endDate: text("end_date"),
    ...timestamps,
  },
  (t) => [
    index("membership_church_idx").on(t.churchId),
    index("membership_person_idx").on(t.personId),
    index("membership_ministry_idx").on(t.ministryId),
    // No máximo um vínculo ativo por pessoa em cada ministério.
    uniqueIndex("membership_active_uq").on(t.personId, t.ministryId).where(sql`${t.endDate} is null`),
  ],
);

/** Ministérios que um usuário líder pode acompanhar. */
export const userMinistryAccess = sqliteTable(
  "user_ministry_access",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ministryId: text("ministry_id")
      .notNull()
      .references(() => ministry.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.userId, t.ministryId] })],
);

/* ───────────────────────── Encontros e presença ───────────────────────── */

export const eventCategory = sqliteTable("event_category", {
  id: id(),
  churchId: churchId(),
  name: text("name").notNull(),
  color: text("color").notNull().default("ember"),
  ...timestamps,
}, (t) => [index("event_category_church_idx").on(t.churchId)]);

export const RECURRENCES = ["weekly", "biweekly", "monthly"] as const;

export const eventSeries = sqliteTable("event_series", {
  id: id(),
  churchId: churchId(),
  title: text("title").notNull(),
  categoryId: text("category_id").references(() => eventCategory.id, {
    onDelete: "set null",
  }),
  recurrence: text("recurrence", { enum: RECURRENCES }).notNull(),
  /** 0 = domingo … 6 = sábado */
  weekday: integer("weekday").notNull(),
  /** HH:mm no fuso da igreja */
  time: text("time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(120),
  location: text("location"),
  /** YYYY-MM-DD */
  startDate: text("start_date").notNull(),
  /** YYYY-MM-DD */
  endDate: text("end_date"),
  ministryIds: text("ministry_ids", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  /** Datas de ocorrências excluídas, para não serem recriadas. */
  excludedDates: text("excluded_dates", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  ...timestamps,
}, (t) => [index("event_series_church_idx").on(t.churchId)]);

export const event = sqliteTable(
  "event",
  {
    id: id(),
    churchId: churchId(),
    title: text("title").notNull(),
    description: text("description"),
    categoryId: text("category_id").references(() => eventCategory.id, {
      onDelete: "set null",
    }),
    seriesId: text("series_id").references(() => eventSeries.id, {
      onDelete: "set null",
    }),
    /** Data original (YYYY-MM-DD) da ocorrência na série; null em encontros avulsos. */
    occurrenceDate: text("occurrence_date"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    location: text("location"),
    cancelled: integer("cancelled", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Token público do QR de autoatendimento. */
    checkinToken: text("checkin_token")
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID().replace(/-/g, "").slice(0, 16)),
    checkinOpen: integer("checkin_open", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (t) => [
    index("event_church_starts_idx").on(t.churchId, t.startsAt),
    index("event_series_idx").on(t.seriesId),
    // Uma ocorrência por data em cada série: geração concorrente não duplica.
    uniqueIndex("event_series_occurrence_uq").on(t.seriesId, t.occurrenceDate),
  ],
);

/** Público do encontro. Sem linhas = igreja toda. */
export const eventMinistry = sqliteTable(
  "event_ministry",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    ministryId: text("ministry_id")
      .notNull()
      .references(() => ministry.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.ministryId] }),
    index("event_ministry_ministry_idx").on(t.ministryId),
  ],
);

export const ATTENDANCE_METHODS = ["manual", "kiosk", "qr"] as const;

export const attendance = sqliteTable(
  "attendance",
  {
    id: id(),
    churchId: churchId(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["present", "absent"] }).notNull(),
    method: text("method", { enum: ATTENDANCE_METHODS })
      .notNull()
      .default("manual"),
    recordedById: text("recorded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attendance_event_person_uq").on(t.eventId, t.personId),
    index("attendance_person_idx").on(t.personId),
    index("attendance_church_idx").on(t.churchId),
  ],
);

/* ───────────────────────── Cuidado pastoral ───────────────────────── */

export const note = sqliteTable(
  "note",
  {
    id: id(),
    churchId: churchId(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    /** team = quem acompanha a pessoa; pastoral = só administradores (pastores). */
    visibility: text("visibility", { enum: ["team", "pastoral"] }).notNull().default("team"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [index("note_person_idx").on(t.personId), index("note_church_idx").on(t.churchId)],
);

export const followUp = sqliteTable(
  "follow_up",
  {
    id: id(),
    churchId: churchId(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind", { enum: ["call", "visit", "message", "prayer", "other"] })
      .notNull()
      .default("call"),
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** YYYY-MM-DD */
    dueDate: text("due_date"),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    outcome: text("outcome"),
    ...timestamps,
  },
  (t) => [
    index("follow_up_person_idx").on(t.personId),
    index("follow_up_church_idx").on(t.churchId),
    index("follow_up_assignee_idx").on(t.assigneeId, t.doneAt),
  ],
);

export const TIMELINE_KINDS = [
  "registered",
  "status",
  "ministry",
  "household",
  "follow_up",
  "profile",
] as const;

export const timelineEvent = sqliteTable(
  "timeline_event",
  {
    id: id(),
    churchId: churchId(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: TIMELINE_KINDS }).notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("timeline_person_idx").on(t.personId, t.occurredAt), index("timeline_church_idx").on(t.churchId)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    churchId: churchId(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    before: text("before", { mode: "json" }),
    after: text("after", { mode: "json" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("audit_entity_idx").on(t.entity, t.entityId),
    index("audit_church_created_idx").on(t.churchId, t.createdAt),
  ],
);

/* ───────────────────────── Relações ───────────────────────── */

export const personRelations = relations(person, ({ one, many }) => ({
  household: one(household, {
    fields: [person.householdId],
    references: [household.id],
  }),
  memberships: many(membership),
  attendances: many(attendance),
  notes: many(note),
  followUps: many(followUp),
}));

export const householdRelations = relations(household, ({ many }) => ({
  members: many(person),
}));

export const ministryRelations = relations(ministry, ({ many }) => ({
  memberships: many(membership),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  person: one(person, {
    fields: [membership.personId],
    references: [person.id],
  }),
  ministry: one(ministry, {
    fields: [membership.ministryId],
    references: [ministry.id],
  }),
}));

export const eventRelations = relations(event, ({ one, many }) => ({
  category: one(eventCategory, {
    fields: [event.categoryId],
    references: [eventCategory.id],
  }),
  series: one(eventSeries, {
    fields: [event.seriesId],
    references: [eventSeries.id],
  }),
  audience: many(eventMinistry),
  attendances: many(attendance),
}));

export const eventMinistryRelations = relations(eventMinistry, ({ one }) => ({
  event: one(event, { fields: [eventMinistry.eventId], references: [event.id] }),
  ministry: one(ministry, {
    fields: [eventMinistry.ministryId],
    references: [ministry.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  event: one(event, { fields: [attendance.eventId], references: [event.id] }),
  person: one(person, {
    fields: [attendance.personId],
    references: [person.id],
  }),
}));

export const noteRelations = relations(note, ({ one }) => ({
  person: one(person, { fields: [note.personId], references: [person.id] }),
  author: one(user, { fields: [note.authorId], references: [user.id] }),
}));

export const followUpRelations = relations(followUp, ({ one }) => ({
  person: one(person, { fields: [followUp.personId], references: [person.id] }),
  assignee: one(user, { fields: [followUp.assigneeId], references: [user.id] }),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  person: one(person, { fields: [user.personId], references: [person.id] }),
  church: one(church, { fields: [user.churchId], references: [church.id] }),
  ministryAccess: many(userMinistryAccess),
}));

export const userMinistryAccessRelations = relations(
  userMinistryAccess,
  ({ one }) => ({
    user: one(user, {
      fields: [userMinistryAccess.userId],
      references: [user.id],
    }),
    ministry: one(ministry, {
      fields: [userMinistryAccess.ministryId],
      references: [ministry.id],
    }),
  }),
);

export const timelineEventRelations = relations(timelineEvent, ({ one }) => ({
  actor: one(user, { fields: [timelineEvent.actorId], references: [user.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, { fields: [auditLog.actorId], references: [user.id] }),
}));

/* ───────────────────────── Assistente (IA) ───────────────────────── */

export const aiConversation = sqliteTable(
  "ai_conversation",
  {
    id: id(),
    churchId: churchId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Nova conversa"),
    /** Formato do histórico: "anthropic" ou "openai" (chat completions). */
    provider: text("provider").notNull().default("anthropic"),
    /** Papel e ministérios do dono quando a conversa começou; muda → histórico fica bloqueado. */
    scopeKey: text("scope_key"),
    /** Trava contra duas perguntas simultâneas na mesma conversa. */
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    /** Histórico no formato da API (MessageParam[]), incluindo blocos de ferramenta. */
    messages: text("messages", { mode: "json" }).$type<unknown[]>().notNull().default(sql`'[]'`),
    ...timestamps,
  },
  (t) => [index("ai_conversation_user_idx").on(t.userId, t.updatedAt)],
);

/** Uma execução do agente (uma pergunta do usuário até a resposta final): base do LLMOps. */
export const aiRun = sqliteTable(
  "ai_run",
  {
    id: id(),
    churchId: churchId(),
    conversationId: text("conversation_id").references(() => aiConversation.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    prompt: text("prompt").notNull(),
    iterations: integer("iterations").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    toolCalls: text("tool_calls", { mode: "json" }).$type<{ name: string; ok: boolean; write: boolean }[]>().notNull().default(sql`'[]'`),
    stopReason: text("stop_reason"),
    error: text("error"),
    /** Texto final mostrado ao usuário (base dos casos de avaliação). */
    answer: text("answer"),
    /** 1 = útil, -1 = não ajudou */
    rating: integer("rating"),
    /** O que faltou, escrito por quem deu 👎. */
    ratingNote: text("rating_note"),
    /** Um administrador já revisou a avaliação negativa. */
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("ai_run_created_idx").on(t.createdAt),
    index("ai_run_church_created_idx").on(t.churchId, t.createdAt),
    index("ai_run_user_idx").on(t.userId),
  ],
);

/**
 * Cada passo de uma execução: uma chamada ao modelo ou a uma ferramenta, com tokens, custo,
 * tempo e erro. Só medidas, nunca o conteúdo (perguntas e dados pessoais ficam fora).
 */
export const aiStep = sqliteTable(
  "ai_step",
  {
    id: id(),
    churchId: churchId(),
    runId: text("run_id")
      .notNull()
      .references(() => aiRun.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    kind: text("kind", { enum: ["model", "tool"] }).notNull(),
    /** Modelo (kind = model) ou ferramenta (kind = tool). */
    name: text("name").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    write: integer("write", { mode: "boolean" }).notNull().default(false),
    error: text("error"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("ai_step_run_idx").on(t.runId), index("ai_step_church_created_idx").on(t.churchId, t.createdAt)],
);

export const aiRunRelations = relations(aiRun, ({ one, many }) => ({
  user: one(user, { fields: [aiRun.userId], references: [user.id] }),
  conversation: one(aiConversation, { fields: [aiRun.conversationId], references: [aiConversation.id] }),
  steps: many(aiStep),
}));

export const aiStepRelations = relations(aiStep, ({ one }) => ({
  run: one(aiRun, { fields: [aiStep.runId], references: [aiRun.id] }),
}));

/** Limite de tentativas compartilhado entre instâncias (Vercel). */
export const rateLimit = sqliteTable("rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});
