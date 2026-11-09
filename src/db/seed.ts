/**
 * Cenário demo: igreja fictícia com ~70 pessoas, famílias, ministérios,
 * cultos recorrentes e 12 semanas de frequência. APAGA o banco atual.
 *
 *   npm run db:seed
 */
import "./load-env";
import { sql } from "drizzle-orm";
import { auth } from "../lib/auth";
import { addDaysIso, isoDateInTz, todayIso, zonedToUtc } from "../lib/dates";
import { occurrences } from "../lib/recurrence";
import { normalizePhone } from "../lib/text";
import { db, schema } from "./index";

const TZ = "America/Sao_Paulo";
const PASSWORD = process.env.SEED_PASSWORD ?? "emaus2026";

// PRNG determinístico: o mesmo seed gera o mesmo cenário.
let state = 20261109;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
// Domingo recente (0 a 3 semanas atrás): visitantes chegam em dia de culto.
const recentSunday = (today: string) => {
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDaysIso(today, -day - 7 * Math.floor(rand() * 4));
};
const chance = (p: number) => rand() < p;

const FEMALE = ["Ana", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Júlia", "Larissa", "Mariana", "Natália", "Patrícia", "Raquel", "Sara", "Tatiane", "Vitória", "Luíza", "Débora", "Priscila", "Lívia"];
const MALE = ["André", "Bruno", "Carlos", "Daniel", "Eduardo", "Felipe", "Gabriel", "Henrique", "Igor", "João", "Lucas", "Mateus", "Nícolas", "Otávio", "Paulo", "Rafael", "Samuel", "Tiago", "Vinícius", "Davi", "Elias", "Josué"];
const SURNAMES = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araújo", "Ribeiro", "Barbosa", "Rocha", "Moreira", "Teixeira", "Mendes"];
const STREETS = ["Rua das Oliveiras", "Rua Emaús", "Av. da Esperança", "Rua do Caminho", "Rua Betânia", "Av. Jerusalém", "Rua das Palmeiras"];

function phone() {
  return `(11) 9${Math.floor(1000 + rand() * 8999)}-${Math.floor(1000 + rand() * 8999)}`;
}

function birth(minAge: number, maxAge: number, today: string) {
  const age = minAge + Math.floor(rand() * (maxAge - minAge));
  const day = Math.floor(rand() * 365);
  return addDaysIso(`${Number(today.slice(0, 4)) - age}-01-01`, day);
}

async function reset() {
  const tables = [
    "audit_log", "timeline_event", "follow_up", "note", "attendance", "event_ministry",
    "event", "event_series", "event_category", "user_ministry_access", "membership",
    "ministry", "session", "account", "verification", "user", "person", "household",
    "church_settings",
  ];
  for (const t of tables) await db.run(sql.raw(`DELETE FROM "${t}"`));
}

async function main() {
  const today = todayIso(TZ);
  await reset();

  await db.insert(schema.churchSettings).values({
    id: 1,
    name: "Comunidade Emaús",
    timezone: TZ,
    careThresholdDays: 21,
  });

  /* Ministérios e categorias */
  const ministries = await db
    .insert(schema.ministry)
    .values([
      { name: "Acolhimento", description: "Recepção, café e integração de visitantes.", color: "ember" },
      { name: "Louvor", description: "Música e liturgia dos cultos.", color: "plum" },
      { name: "Jovens", description: "Encontros e discipulado para 15 a 29 anos.", color: "sky" },
      { name: "Infantil", description: "Ensino bíblico para crianças.", color: "gold" },
      { name: "Intercessão", description: "Oração pela igreja e pela cidade.", color: "sage" },
      { name: "Casais", description: "Cuidado e formação de famílias.", color: "rose" },
    ])
    .returning();
  const M = Object.fromEntries(ministries.map((m) => [m.name, m.id]));

  const categories = await db
    .insert(schema.eventCategory)
    .values([
      { name: "Culto", color: "ember" },
      { name: "Jovens", color: "sky" },
      { name: "Oração", color: "sage" },
      { name: "Evento", color: "gold" },
    ])
    .returning();
  const C = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  /* Famílias e pessoas */
  type P = typeof schema.person.$inferInsert & { id: string; engagement: number };
  const people: P[] = [];
  const addPerson = (p: Omit<P, "id" | "phoneDigits">) => {
    const id = crypto.randomUUID();
    people.push({ ...p, id, phoneDigits: p.phone ? normalizePhone(p.phone) : null });
    return id;
  };

  const households: (typeof schema.household.$inferInsert & { id: string })[] = [];
  const usedSurnames = [...SURNAMES].sort(() => rand() - 0.5);
  for (let h = 0; h < 16; h++) {
    const surname = usedSurnames[h % usedSurnames.length];
    const id = crypto.randomUUID();
    const address = `${pick(STREETS)}, ${Math.floor(10 + rand() * 900)}`;
    households.push({ id, name: `Família ${surname}`, address });
    const engagement = 0.35 + rand() * 0.6;
    const since = addDaysIso(today, -Math.floor(200 + rand() * 3000));
    const status = h < 13 ? "member" : "visitor";
    const head = chance(0.5);
    addPerson({
      fullName: `${pick(MALE)} ${surname}`,
      gender: "male",
      status,
      phone: phone(),
      birthDate: birth(28, 65, today),
      householdId: id,
      householdRole: head ? "head" : "spouse",
      address,
      memberSince: status === "member" ? since : null,
      firstVisitDate: status === "visitor" ? recentSunday(today) : null,
      engagement,
    });
    addPerson({
      fullName: `${pick(FEMALE)} ${pick(SURNAMES)} ${surname}`,
      gender: "female",
      status,
      phone: phone(),
      birthDate: birth(26, 62, today),
      householdId: id,
      householdRole: head ? "spouse" : "head",
      address,
      memberSince: status === "member" ? since : null,
      firstVisitDate: status === "visitor" ? recentSunday(today) : null,
      engagement: Math.min(1, engagement + 0.1),
    });
    const kids = Math.floor(rand() * 3.2);
    for (let k = 0; k < kids; k++) {
      const female = chance(0.5);
      addPerson({
        fullName: `${pick(female ? FEMALE : MALE)} ${surname}`,
        gender: female ? "female" : "male",
        status,
        birthDate: birth(3, 24, today),
        householdId: id,
        householdRole: "child",
        address,
        memberSince: status === "member" ? since : null,
        engagement: engagement * 0.9,
      });
    }
  }

  // Pessoas sozinhas: jovens, membros afastados, visitantes recentes, inativos.
  for (let i = 0; i < 16; i++) {
    const female = chance(0.55);
    const kind = i < 8 ? "member" : i < 12 ? "away" : i < 14 ? "visitor" : "inactive";
    addPerson({
      fullName: `${pick(female ? FEMALE : MALE)} ${pick(SURNAMES)}`,
      gender: female ? "female" : "male",
      status: kind === "away" ? "member" : (kind as "member" | "visitor" | "inactive"),
      phone: phone(),
      birthDate: birth(17, 40, today),
      memberSince: kind === "member" || kind === "away" ? addDaysIso(today, -Math.floor(300 + rand() * 1500)) : null,
      firstVisitDate: kind === "visitor" ? recentSunday(today) : null,
      howFound: kind === "visitor" ? pick(["Convite de amigo", "Instagram", "Passou na frente", "Família"]) : null,
      // Afastados: frequentavam e pararam de vir há algumas semanas.
      engagement: kind === "away" ? -1 : kind === "inactive" ? 0 : 0.5 + rand() * 0.45,
    });
  }

  // Aniversariantes garantidos nos próximos dias para o painel.
  people.filter((p) => p.householdRole === "head").slice(0, 3).forEach((p, i) => {
    const y = Number((p.birthDate as string).slice(0, 4));
    p.birthDate = `${y}${addDaysIso(today, i * 3 + 1).slice(4)}`;
  });

  await db.insert(schema.household).values(households);
  const created = await db
    .insert(schema.person)
    .values(people.map(({ engagement: _e, ...p }) => ({ ...p, createdAt: new Date(Date.now() - 200 * 86_400_000) })))
    .returning();

  for (const p of created) {
    await db.insert(schema.timelineEvent).values({
      personId: p.id,
      kind: "registered",
      title: p.status === "visitor" ? "Primeira visita registrada" : "Cadastrado como membro",
      occurredAt: p.memberSince ? zonedToUtc(p.memberSince, "10:00", TZ) : p.createdAt,
    });
  }

  /* Vínculos com ministérios */
  const ageOf = (p: P) => (p.birthDate ? Number(today.slice(0, 4)) - Number(String(p.birthDate).slice(0, 4)) : 30);
  const memberships: (typeof schema.membership.$inferInsert)[] = [];
  const join = (personId: string, ministry: string, role: "member" | "leader" = "member") =>
    memberships.push({ personId, ministryId: M[ministry], role, startDate: addDaysIso(today, -Math.floor(60 + rand() * 700)) });
  const adults = people.filter((p) => p.status === "member" && ageOf(p) >= 25);
  const youth = people.filter((p) => p.status !== "inactive" && ageOf(p) >= 15 && ageOf(p) < 30);
  for (const p of youth) join(p.id, "Jovens");
  adults.slice(0, 7).forEach((p) => join(p.id, "Acolhimento"));
  adults.slice(5, 11).forEach((p) => join(p.id, "Louvor"));
  adults.slice(9, 15).forEach((p) => join(p.id, "Infantil"));
  adults.slice(12, 18).forEach((p) => join(p.id, "Intercessão"));
  adults.filter((p) => p.householdRole === "head" || p.householdRole === "spouse").slice(0, 12).forEach((p) => join(p.id, "Casais"));
  // Um líder por ministério.
  for (const name of Object.keys(M)) {
    const first = memberships.find((m) => m.ministryId === M[name]);
    if (first) first.role = "leader";
  }
  await db.insert(schema.membership).values(memberships);

  /* Séries e encontros (12 semanas para trás + 12 à frente) */
  const start = addDaysIso(today, -7 * 12);
  const until = addDaysIso(today, 7 * 12);
  const seriesDefs = [
    { title: "Culto de Celebração", category: "Culto", weekday: 0, time: "19:00", ministries: [] as string[], location: "Templo" },
    { title: "Culto de Oração", category: "Oração", weekday: 3, time: "20:00", ministries: [], location: "Templo" },
    { title: "Encontro de Jovens", category: "Jovens", weekday: 6, time: "19:30", ministries: ["Jovens"], location: "Salão" },
  ];
  type Ev = typeof schema.event.$inferSelect;
  const allEvents: { ev: Ev; def: (typeof seriesDefs)[number] }[] = [];
  for (const def of seriesDefs) {
    const [series] = await db
      .insert(schema.eventSeries)
      .values({
        title: def.title,
        categoryId: C[def.category],
        recurrence: "weekly",
        weekday: def.weekday,
        time: def.time,
        durationMinutes: 120,
        location: def.location,
        startDate: start,
        ministryIds: def.ministries.map((n) => M[n]),
      })
      .returning();
    for (const date of occurrences({ recurrence: "weekly", weekday: def.weekday, startDate: start, from: start, until })) {
      const startsAt = zonedToUtc(date, def.time, TZ);
      const [ev] = await db
        .insert(schema.event)
        .values({
          title: def.title,
          categoryId: C[def.category],
          seriesId: series.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 120 * 60_000),
          location: def.location,
        })
        .returning();
      if (def.ministries.length) {
        await db.insert(schema.eventMinistry).values(def.ministries.map((n) => ({ eventId: ev.id, ministryId: M[n] })));
      }
      allEvents.push({ ev, def });
    }
  }
  const [special] = await db
    .insert(schema.event)
    .values({
      title: "Noite de Louvor e Testemunhos",
      description: "Culto especial com a participação de todos os ministérios.",
      categoryId: C["Evento"],
      startsAt: zonedToUtc(addDaysIso(today, 12), "19:30", TZ),
      endsAt: zonedToUtc(addDaysIso(today, 12), "22:00", TZ),
      location: "Templo",
    })
    .returning();
  void special;

  /* Frequência dos encontros passados */
  const now = Date.now();
  const youthIds = new Set(youth.map((p) => p.id));
  const records: (typeof schema.attendance.$inferInsert)[] = [];
  for (const { ev, def } of allEvents) {
    if (ev.startsAt.getTime() > now) continue;
    const eventDate = isoDateInTz(ev.startsAt, TZ);
    const weeksAgo = Math.floor((now - ev.startsAt.getTime()) / (7 * 86_400_000));
    for (const p of people) {
      if (p.status === "inactive") continue;
      if (def.ministries.includes("Jovens") && !youthIds.has(p.id)) continue;
      if (p.status === "visitor" && p.firstVisitDate && eventDate < p.firstVisitDate) continue;
      let prob = p.engagement;
      if (prob < 0) prob = weeksAgo > 5 ? 0.85 : 0; // afastados
      if (def.weekday === 3) prob *= 0.45; // oração tem menos gente
      if (p.status === "visitor") prob = eventDate === p.firstVisitDate ? 1 : prob * 0.6;
      const present = chance(prob);
      if (present || (def.ministries.length && chance(0.5))) {
        records.push({
          eventId: ev.id,
          personId: p.id,
          status: present ? "present" : "absent",
          method: present && chance(0.25) ? "qr" : "manual",
          createdAt: ev.startsAt,
          updatedAt: ev.startsAt,
        });
      }
    }
  }
  for (let i = 0; i < records.length; i += 400) {
    await db.insert(schema.attendance).values(records.slice(i, i + 400));
  }

  /* Contas */
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(PASSWORD);
  const leaderPerson = created.find((p) => memberships.some((m) => m.personId === p.id && m.ministryId === M["Jovens"] && m.role === "leader"));
  const accounts = [
    { username: "admin", name: "Pastor Daniel", email: "admin@emaus.local", role: "admin" as const, personId: null },
    { username: "secretaria", name: "Raquel Secretaria", email: "secretaria@emaus.local", role: "secretary" as const, personId: null },
    { username: "lider", name: leaderPerson?.fullName ?? "Líder Jovens", email: "lider@emaus.local", role: "leader" as const, personId: leaderPerson?.id ?? null },
  ];
  const users: Record<string, string> = {};
  for (const a of accounts) {
    const u = await ctx.internalAdapter.createUser({ ...a, displayUsername: a.username, active: true }, { method: "admin" });
    await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: hash });
    users[a.username] = u.id;
  }
  await db.insert(schema.userMinistryAccess).values({ userId: users.lider, ministryId: M["Jovens"] });

  /* Notas e acompanhamentos */
  const members = created.filter((p) => p.status === "member");
  const notes = [
    "Conversamos depois do culto. Está passando por um período de mudança de emprego; pediu oração.",
    "Se ofereceu para ajudar no Acolhimento aos domingos.",
    "Visitamos a família; estão bem e agradeceram o cuidado.",
    "Comentou interesse em fazer o curso de batismo no próximo semestre.",
  ];
  for (const [i, text] of notes.entries()) {
    await db.insert(schema.note).values({
      personId: members[i * 3].id,
      authorId: users.admin,
      content: text,
      pinned: i === 0,
      createdAt: new Date(now - (i + 1) * 5 * 86_400_000),
    });
  }
  const away = created.filter((p) => people.find((x) => x.id === p.id)!.engagement < 0);
  await db.insert(schema.followUp).values([
    { personId: away[0].id, title: "Ligar para saber como está", kind: "call", assigneeId: users.admin, createdById: users.admin, dueDate: addDaysIso(today, 1) },
    { personId: away[1].id, title: "Visita em casa com a liderança", kind: "visit", assigneeId: users.secretaria, createdById: users.admin, dueDate: addDaysIso(today, 4) },
    { personId: created.find((p) => p.status === "visitor")!.id, title: "Mensagem de boas-vindas", kind: "message", assigneeId: users.admin, createdById: users.admin, dueDate: today },
  ]);

  console.log(`Seed concluído: ${created.length} pessoas, ${households.length} famílias, ${allEvents.length + 1} encontros, ${records.length} registros de presença.`);
  console.log(`Contas: admin, secretaria, lider — senha: ${PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
