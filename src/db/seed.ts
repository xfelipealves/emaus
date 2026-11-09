/**
 * Cenário demo inspirado na estrutura real da IEQ Buriti Sereno: ministérios,
 * agenda semanal e eventos recentes. Todas as PESSOAS, telefones e anotações são
 * fictícios. APAGA o banco atual.
 *
 *   npm run db:seed
 */
import "./load-env";
import { sql } from "drizzle-orm";
import type { HouseholdRole, PersonStatus } from "./schema";
import { auth } from "../lib/auth";
import { addDaysIso, isoDateInTz, todayIso, weekdayOfIso, zonedToUtc } from "../lib/dates";
import { occurrences } from "../lib/recurrence";
import { normalizePhone } from "../lib/text";
import { db, schema } from "./index";

const TZ = "America/Sao_Paulo";
const PASSWORD = process.env.SEED_PASSWORD ?? "emaus2026";
const CHURCH = "IEQ Buriti Sereno";

// PRNG determinístico: o mesmo seed gera o mesmo cenário.
let state = 20261109;
const rand = () => {
  state = (state * 1664525 + 1013904223) % 2 ** 32;
  return state / 2 ** 32;
};
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T,>(xs: T[]) => [...xs].sort(() => rand() - 0.5);

const FEMALE = ["Ana Clara", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Júlia", "Larissa", "Mariana", "Natália", "Patrícia", "Raquel", "Sara", "Tatiane", "Vitória", "Luíza", "Débora", "Priscila", "Lívia", "Rebeca", "Ester", "Raissa", "Yasmin", "Kamila", "Nayara", "Jéssica", "Thaís", "Bianca", "Lorena", "Sofia", "Alice", "Manuela", "Cecília", "Rosângela", "Marlene", "Cleide", "Valdirene", "Sônia", "Aparecida"];
const MALE = ["André", "Bruno", "Carlos", "Daniel", "Eduardo", "Felipe", "Gabriel", "Henrique", "Igor", "João Pedro", "Lucas", "Mateus", "Nícolas", "Otávio", "Paulo", "Rafael", "Samuel", "Tiago", "Vinícius", "Davi", "Elias", "Josué", "Arthur", "Heitor", "Miguel", "Enzo", "Kauã", "Wesley", "Wellington", "Jefferson", "Leandro", "Rodrigo", "Marcos", "Valdeci", "Sebastião", "Antônio", "Edson"];
const SURNAMES = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araújo", "Ribeiro", "Barbosa", "Rocha", "Moreira", "Teixeira", "Mendes", "Gomes", "Martins", "Ferreira", "Cardoso", "Batista", "Freitas", "Machado", "Rezende", "Borges", "Queiroz", "Vieira", "Campos", "Fonseca", "Prado", "Siqueira", "Amorim", "Peixoto", "Godoy", "Brandão", "Nogueira", "Melo", "Pires", "Dias", "Rios", "Xavier", "Lacerda", "Toledo", "Matos", "Pacheco", "Assis", "Cunha", "Neves"];
const STREETS = ["Rua BS-3", "Rua BS-7", "Rua BS-12", "Av. Buriti", "Rua dos Ipês", "Rua Sereno", "Av. Independência", "Rua das Acácias", "Rua Jequitibá"];

function phone() {
  return `(62) 9${Math.floor(8000 + rand() * 1999)}-${Math.floor(1000 + rand() * 8999)}`;
}

function birth(minAge: number, maxAge: number, today: string) {
  const age = minAge + Math.floor(rand() * (maxAge - minAge + 1));
  return addDaysIso(`${Number(today.slice(0, 4)) - age - 1}-01-01`, Math.floor(rand() * 365));
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

type Draft = {
  id: string;
  fullName: string;
  gender: "female" | "male";
  status: PersonStatus;
  phone: string | null;
  birthDate: string;
  householdId: string | null;
  householdRole: HouseholdRole | null;
  address: string | null;
  memberSince: string | null;
  firstVisitDate: string | null;
  howFound: string | null;
  /** 0–1: chance de vir; -1 = afastado (vinha e parou) */
  engagement: number;
};

async function main() {
  const today = todayIso(TZ);
  const age = (p: Draft) => Number(today.slice(0, 4)) - Number(p.birthDate.slice(0, 4));
  await reset();

  await db.insert(schema.churchSettings).values({ id: 1, name: CHURCH, timezone: TZ, careThresholdDays: 21 });

  /* ───────────── Ministérios e categorias (estrutura real) ───────────── */
  const ministries = await db
    .insert(schema.ministry)
    .values([
      { name: "Louvor", description: "Ministério de louvor: escalas de domingo e quarta, ensaios e a Cantata de Natal.", color: "plum" },
      { name: "Mídia", description: "Escala mensal: computador, iluminação, fotos, stories e cerimonial nos cultos de domingo e quarta.", color: "sky" },
      { name: "New Mind", description: "Adolescentes. Culto aos sábados às 17h (série Fruto do Espírito), discipulado às quintas e jejum semanal da liderança.", color: "ember" },
      { name: "Metanoia", description: "Jovens. Acampamentos e Revival Night; a liderança forma a equipe de Supervisão.", color: "teal" },
      { name: "New Song", description: "Banda de louvor dos adolescentes. Escala e ensaio aos sábados às 15h30, antes do New Mind.", color: "gold" },
      { name: "Homens de Honra", description: "Ministério de homens: encontros “Homens ao Máximo” às quintas.", color: "slate" },
      { name: "Casa de Paz", description: "Rede de células “Paixão e Ousadia”: lições às terças nas casas (série Milagres).", color: "sage" },
    ])
    .returning();
  const M = Object.fromEntries(ministries.map((m) => [m.name, m.id])) as Record<string, string>;

  const categories = await db
    .insert(schema.eventCategory)
    .values([
      { name: "Culto", color: "ember" },
      { name: "Adolescentes", color: "gold" },
      { name: "Jovens", color: "teal" },
      { name: "Discipulado", color: "sky" },
      { name: "Célula", color: "sage" },
      { name: "Homens", color: "slate" },
      { name: "Ensaio", color: "plum" },
      { name: "Evento", color: "rose" },
    ])
    .returning();
  const C = Object.fromEntries(categories.map((c) => [c.name, c.id])) as Record<string, string>;

  /* ───────────── Pessoas e famílias (fictícias) ───────────── */
  const people: Draft[] = [];
  const households: (typeof schema.household.$inferInsert & { id: string })[] = [];
  const add = (p: Omit<Draft, "id">) => {
    const d = { ...p, id: crypto.randomUUID() };
    people.push(d);
    return d;
  };
  const recentSunday = (maxWeeks: number) => addDaysIso(today, -weekdayOfIso(today) - 7 * Math.floor(rand() * maxWeeks));
  const surnames = shuffle(SURNAMES);

  for (let h = 0; h < 46; h++) {
    const surname = surnames[h % surnames.length];
    const id = crypto.randomUUID();
    const address = `${pick(STREETS)}, Qd. ${Math.floor(1 + rand() * 60)} Lt. ${Math.floor(1 + rand() * 30)} — Buriti Sereno`;
    households.push({ id, name: `Família ${surname}`, address });
    const isVisitor = h >= 42;
    const status: PersonStatus = isVisitor ? "visitor" : "member";
    const engagement = 0.45 + rand() * 0.5;
    const since = isVisitor ? null : addDaysIso(today, -Math.floor(150 + rand() * 4500));
    const firstVisit = isVisitor ? recentSunday(4) : null;
    const parentAge: [number, number] = h % 5 === 0 ? [50, 68] : [30, 48];
    const base = { status, householdId: id, address, memberSince: since, firstVisitDate: firstVisit, howFound: isVisitor ? pick(["Convite de um amigo", "Instagram da igreja", "Vizinho da igreja", "Família"]) : null };
    add({ ...base, fullName: `${pick(MALE)} ${surname}`, gender: "male", phone: phone(), birthDate: birth(...parentAge, today), householdRole: "head", engagement });
    if (h % 7 !== 3) {
      add({ ...base, fullName: `${pick(FEMALE)} ${pick(SURNAMES)} ${surname}`, gender: "female", phone: phone(), birthDate: birth(parentAge[0] - 2, parentAge[1] - 2, today), householdRole: "spouse", engagement: Math.min(0.98, engagement + 0.1) });
    }
    if (parentAge[0] < 50) {
      // Filhos: crianças (New Song), adolescentes (New Mind) e jovens (Metanoia).
      const kids = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < kids; k++) {
        const female = chance(0.5);
        const band = pick([[6, 11], [12, 17], [12, 17], [18, 23]] as const);
        add({ ...base, fullName: `${pick(female ? FEMALE : MALE)} ${surname}`, gender: female ? "female" : "male", phone: band[0] >= 12 ? phone() : null, birthDate: birth(band[0], band[1], today), householdRole: "child", engagement: engagement * (band[0] >= 18 ? 0.85 : 0.95) });
      }
    }
  }

  // Jovens e adultos sem família vinculada, afastados, visitantes e inativos.
  const loose: [number, PersonStatus | "away", [number, number]][] = [
    [26, "member", [18, 29]],
    [8, "member", [30, 75]],
    [8, "away", [18, 45]],
    [9, "visitor", [15, 35]],
    [7, "inactive", [20, 60]],
  ];
  for (const [count, kind, range] of loose) {
    for (let i = 0; i < count; i++) {
      const female = chance(0.55);
      add({
        fullName: `${pick(female ? FEMALE : MALE)} ${pick(SURNAMES)} ${pick(SURNAMES)}`,
        gender: female ? "female" : "male",
        status: kind === "away" ? "member" : kind,
        phone: phone(),
        birthDate: birth(range[0], range[1], today),
        householdId: null,
        householdRole: null,
        address: null,
        memberSince: kind === "member" || kind === "away" ? addDaysIso(today, -Math.floor(200 + rand() * 2500)) : null,
        firstVisitDate: kind === "visitor" ? recentSunday(5) : null,
        howFound: kind === "visitor" ? pick(["Convite de um amigo", "Instagram da igreja", "Veio com a turma do New Mind", "Acampamento Metanoia", "Passou na frente"]) : null,
        engagement: kind === "away" ? -1 : kind === "inactive" ? 0 : 0.5 + rand() * 0.45,
      });
    }
  }

  // Aniversariantes garantidos nos próximos dias.
  people.filter((p) => p.status === "member" && p.householdRole === "head").slice(0, 4).forEach((p, i) => {
    p.birthDate = `${p.birthDate.slice(0, 4)}${addDaysIso(today, i * 3 + 1).slice(4)}`;
  });

  await db.insert(schema.household).values(households);
  const created = await db
    .insert(schema.person)
    .values(
      people.map(({ engagement: _e, ...p }) => ({
        ...p,
        phoneDigits: p.phone ? normalizePhone(p.phone) : null,
        createdAt: new Date(Date.now() - 220 * 86_400_000),
      })),
    )
    .returning();
  for (const p of created) {
    await db.insert(schema.timelineEvent).values({
      personId: p.id,
      kind: "registered",
      title: p.status === "visitor" ? "Primeira visita registrada" : "Cadastrado como membro",
      occurredAt: zonedToUtc(p.memberSince ?? p.firstVisitDate ?? addDaysIso(today, -220), "10:00", TZ),
    });
  }

  /* ───────────── Vínculos com ministérios ───────────── */
  const active = people.filter((p) => p.status !== "inactive");
  const memberships: (typeof schema.membership.$inferInsert)[] = [];
  const joined = new Set<string>();
  const join = (p: Draft, ministry: string, role: "member" | "leader" = "member", startDate?: string) => {
    const key = `${p.id}:${ministry}`;
    if (joined.has(key)) return;
    joined.add(key);
    memberships.push({ personId: p.id, ministryId: M[ministry], role, startDate: startDate ?? addDaysIso(today, -Math.floor(40 + rand() * 900)) });
  };
  const teens = active.filter((p) => age(p) >= 12 && age(p) <= 17);
  const youth = active.filter((p) => age(p) >= 18 && age(p) <= 29);
  const adults = active.filter((p) => age(p) >= 30 && p.status === "member");
  const men = adults.filter((p) => p.gender === "male");

  // New Song: músicos e vocal entre adolescentes e jovens.
  shuffle([...teens.filter((p) => age(p) >= 14), ...youth]).slice(0, 15).forEach((p, i) => join(p, "New Song", i === 0 ? "leader" : "member"));
  teens.forEach((p) => join(p, "New Mind"));
  shuffle(youth).slice(0, 6).forEach((p) => join(p, "New Mind", "leader"));
  // Liderança primeiro: join ignora vínculo repetido (equipe de Supervisão).
  shuffle(youth).slice(0, 4).forEach((p) => join(p, "Metanoia", "leader"));
  youth.forEach((p) => join(p, "Metanoia"));
  const louvor = shuffle([...youth, ...adults.slice(0, 30)]).slice(0, 22);
  louvor.forEach((p, i) => join(p, "Louvor", i === 0 ? "leader" : "member"));
  const midia = shuffle([...teens.filter((p) => age(p) >= 15), ...youth]).slice(0, 14);
  midia.forEach((p, i) => join(p, "Mídia", i === 0 ? "leader" : "member", i >= 12 ? "2026-10-31" : undefined));
  men.filter(() => chance(0.75)).forEach((p, i) => join(p, "Homens de Honra", i < 2 ? "leader" : "member"));
  shuffle(adults).slice(0, 22).forEach((p, i) => join(p, "Casa de Paz", i < 2 ? "leader" : "member"));
  await db.insert(schema.membership).values(memberships);
  const inMinistry = (p: Draft, name: string) => joined.has(`${p.id}:${name}`);

  /* ───────────── Agenda semanal (real) ───────────── */
  const start = addDaysIso(today, -7 * 12);
  const until = addDaysIso(today, 7 * 12);
  type Def = {
    title: string;
    category: string;
    weekday: number;
    time: string;
    minutes: number;
    ministries: string[];
    location: string;
    from?: string;
    to?: string;
    /** quem costuma vir e com que peso sobre o engajamento */
    who: (p: Draft) => number;
  };
  const defs: Def[] = [
    { title: "Culto de Celebração", category: "Culto", weekday: 0, time: "18:00", minutes: 120, ministries: [], location: "Templo", who: () => 0.85 },
    { title: "Quarta do Poder", category: "Culto", weekday: 3, time: "19:30", minutes: 90, ministries: [], location: "Templo", who: (p) => (age(p) >= 18 ? 0.5 : 0.2) },
    { title: "Culto New Mind", category: "Adolescentes", weekday: 6, time: "17:00", minutes: 120, ministries: ["New Mind"], location: "Templo", who: (p) => (inMinistry(p, "New Mind") ? 0.95 : 0) },
    { title: "Discipulado New Mind", category: "Discipulado", weekday: 4, time: "20:30", minutes: 90, ministries: ["New Mind"], location: "Salão", who: (p) => (inMinistry(p, "New Mind") ? 0.55 : 0) },
    { title: "Homens ao Máximo", category: "Homens", weekday: 4, time: "19:30", minutes: 90, ministries: ["Homens de Honra"], location: "Salão", who: (p) => (inMinistry(p, "Homens de Honra") ? 0.65 : 0) },
    { title: "Casa de Paz — Paixão e Ousadia", category: "Célula", weekday: 2, time: "20:00", minutes: 90, ministries: ["Casa de Paz"], location: "Casa da família anfitriã", who: (p) => (inMinistry(p, "Casa de Paz") ? 0.75 : 0) },
    { title: "Ensaio New Song", category: "Ensaio", weekday: 6, time: "15:30", minutes: 90, ministries: ["New Song"], location: "Templo", who: (p) => (inMinistry(p, "New Song") ? 0.8 : 0) },
  ];

  type Ev = typeof schema.event.$inferSelect;
  const all: { ev: Ev; who: (p: Draft) => number; tracksAbsence: boolean }[] = [];
  const createEvent = async (opts: {
    title: string; category: string; date: string; time: string; minutes: number; ministries: string[];
    location: string; seriesId?: string; description?: string; cancelled?: boolean; who: (p: Draft) => number;
  }) => {
    const startsAt = zonedToUtc(opts.date, opts.time, TZ);
    const [ev] = await db
      .insert(schema.event)
      .values({
        title: opts.title,
        description: opts.description ?? null,
        categoryId: C[opts.category],
        seriesId: opts.seriesId ?? null,
        startsAt,
        endsAt: new Date(startsAt.getTime() + opts.minutes * 60_000),
        location: opts.location,
        cancelled: opts.cancelled ?? false,
      })
      .returning();
    if (opts.ministries.length) {
      await db.insert(schema.eventMinistry).values(opts.ministries.map((n) => ({ eventId: ev.id, ministryId: M[n] })));
    }
    all.push({ ev, who: opts.who, tracksAbsence: opts.ministries.length > 0 });
    return ev;
  };

  // Agenda real do New Mind e da Celebração: folgas, retiro, temáticos e Santa Ceia.
  const overrides: Record<string, { cancelled?: boolean; title?: string; description?: string }> = {
    "Culto New Mind@2026-10-03": { cancelled: true, description: "Sem culto: casamento de dois líderes." },
    "Culto New Mind@2026-10-17": { cancelled: true, description: "Folga do mês." },
    "Culto New Mind@2026-10-24": { cancelled: true, description: "Adolescentes no Acamp Jovem." },
    "Ensaio New Song@2026-10-24": { cancelled: true },
    "Culto New Mind@2026-10-31": { title: "Culto Temático New Mind" },
    "Culto New Mind@2026-11-14": { cancelled: true, description: "Confraternização da liderança; momento de busca na sexta (13/11)." },
    "Culto New Mind@2026-11-21": { cancelled: true, description: "Programação separada: festa do pijama das meninas." },
    "Culto New Mind@2026-11-28": { title: "Culto Temático New Mind" },
    "Ensaio New Song@2026-11-14": { cancelled: true },
    "Ensaio New Song@2026-11-21": { cancelled: true },
  };

  for (const d of defs) {
    const from = d.from && d.from > start ? d.from : start;
    const to = d.to && d.to < until ? d.to : until;
    const [series] = await db
      .insert(schema.eventSeries)
      .values({
        title: d.title,
        categoryId: C[d.category],
        recurrence: "weekly",
        weekday: d.weekday,
        time: d.time,
        durationMinutes: d.minutes,
        location: d.location,
        startDate: from,
        endDate: d.to ?? null,
        ministryIds: d.ministries.map((n) => M[n]),
      })
      .returning();
    for (const date of occurrences({ recurrence: "weekly", weekday: d.weekday, startDate: from, from, until: to })) {
      const o = overrides[`${d.title}@${date}`] ?? {};
      // Santa Ceia no 2º domingo do mês.
      const ceia = d.weekday === 0 && Math.ceil(Number(date.slice(8)) / 7) === 2;
      await createEvent({ ...d, date, seriesId: series.id, cancelled: o.cancelled, description: o.description, title: o.title ?? (ceia ? `${d.title} — Santa Ceia` : d.title) });
    }
  }

  // Eventos pontuais (datas reais de outubro–dezembro de 2026).
  const youthAndTeens = (p: Draft) => (inMinistry(p, "Metanoia") ? 0.7 : inMinistry(p, "New Mind") ? 0.55 : 0);
  const adultsOnly = (p: Draft) => (age(p) >= 18 ? 0.35 : 0);
  await createEvent({ title: "Pré-Encontro", category: "Evento", date: "2026-09-10", time: "19:30", minutes: 120, ministries: [], location: "Templo", description: "Preparação para o Encontro com Deus.", who: (p) => (inMinistry(p, "Casa de Paz") ? 0.6 : adultsOnly(p) * 0.5) });
  await createEvent({ title: "Encontro com Deus", category: "Evento", date: "2026-09-12", time: "07:00", minutes: 14 * 60, ministries: [], location: "Chácara", description: "Retiro de um dia para novos convertidos e membros, com pré e pós-encontro.", who: (p) => adultsOnly(p) * (p.status === "visitor" ? 0 : 1) });
  await createEvent({ title: "Subida ao monte", category: "Jovens", date: "2026-09-25", time: "19:00", minutes: 150, ministries: ["Metanoia"], location: "Saída da igreja", description: "Noite de oração dos jovens no monte.", who: (p) => (inMinistry(p, "Metanoia") ? 0.25 : 0) });
  await createEvent({ title: "Metanoia Encounter", category: "Jovens", date: "2026-09-26", time: "19:30", minutes: 150, ministries: ["Metanoia"], location: "Templo", description: "Reunião de jovens.", who: (p) => (inMinistry(p, "Metanoia") ? 0.65 : 0) });
  await createEvent({ title: "Outubro Rosa — Momento das Mulheres", category: "Evento", date: "2026-10-10", time: "16:00", minutes: 150, ministries: [], location: "Templo", description: "Palestra sobre prevenção do câncer de mama, com uma médica convidada.", who: (p) => (p.gender === "female" && age(p) >= 14 ? 0.45 : 0) });
  await createEvent({ title: "Acamp Jovem — Despertar", category: "Jovens", date: "2026-10-24", time: "07:00", minutes: 31 * 60, ministries: ["Metanoia", "New Mind"], location: "Chácara", description: "Dois dias de pregações, festa neon e comunhão. Encontro na igreja às 7h.", who: youthAndTeens });
  await createEvent({ title: "Revival Night", category: "Jovens", date: "2026-10-30", time: "19:30", minutes: 150, ministries: ["Metanoia"], location: "Templo", description: "Pós-acampamento: uma noite para mergulhar ainda mais na presença de Jesus.", who: (p) => (inMinistry(p, "Metanoia") ? 0.6 : 0) });
  await createEvent({ title: "Momento de busca com Deus", category: "Adolescentes", date: "2026-11-13", time: "19:30", minutes: 120, ministries: ["New Mind"], location: "Templo", description: "No lugar do culto de sábado, que ficou para a confra da liderança.", who: () => 0 });
  await createEvent({ title: "Confraternização da Liderança", category: "Evento", date: "2026-11-14", time: "19:00", minutes: 180, ministries: [], location: "Salão", description: "Confra geral da liderança de todos os ministérios, convocada pela pastora.", who: () => 0 });
  await createEvent({ title: "Festa do Pijama das Meninas", category: "Adolescentes", date: "2026-11-21", time: "20:00", minutes: 12 * 60, ministries: ["New Mind"], location: "Casa de uma líder", description: "Programação separada no fim de semana de folga do New Mind.", who: () => 0 });
  await createEvent({ title: "Cantata de Natal", category: "Evento", date: "2026-12-20", time: "18:00", minutes: 150, ministries: [], location: "Templo", description: "Ministério de louvor; decoração a cargo da liderança do New Mind.", who: () => 0 });

  /* ───────────── Frequência dos encontros que já aconteceram ───────────── */
  const now = Date.now();
  const records: (typeof schema.attendance.$inferInsert)[] = [];
  for (const { ev, who, tracksAbsence } of all) {
    if (ev.cancelled || ev.startsAt.getTime() > now) continue;
    const eventDate = isoDateInTz(ev.startsAt, TZ);
    const weeksAgo = Math.floor((now - ev.startsAt.getTime()) / (7 * 86_400_000));
    for (const p of people) {
      if (p.status === "inactive") continue;
      const weight = who(p);
      if (weight === 0) continue;
      if (p.status === "visitor" && p.firstVisitDate && eventDate < p.firstVisitDate) continue;
      let prob = p.engagement < 0 ? (weeksAgo > 5 ? 0.8 : 0) : p.engagement;
      prob *= weight;
      if (p.status === "visitor") prob = eventDate === p.firstVisitDate ? 1 : prob * 0.7;
      const present = chance(prob);
      // Encontros de ministério registram ausências; cultos abertos só presença.
      if (present || (tracksAbsence && chance(0.6))) {
        records.push({
          eventId: ev.id,
          personId: p.id,
          status: present ? "present" : "absent",
          method: present && chance(0.3) ? "qr" : "manual",
          createdAt: ev.startsAt,
          updatedAt: ev.startsAt,
        });
      }
    }
  }
  for (let i = 0; i < records.length; i += 400) await db.insert(schema.attendance).values(records.slice(i, i + 400));

  /* ───────────── Contas ───────────── */
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(PASSWORD);
  const newMindLeader = people.find((p) => joined.has(`${p.id}:New Mind`) && memberships.some((m) => m.personId === p.id && m.ministryId === M["New Mind"] && m.role === "leader"))!;
  const accounts = [
    { username: "admin", name: "Pastora Regina", email: "pastora@emaus.local", role: "admin" as const, personId: null },
    { username: "secretaria", name: "Secretaria IEQ", email: "secretaria@emaus.local", role: "secretary" as const, personId: null },
    { username: "lider", name: newMindLeader.fullName, email: "newmind@emaus.local", role: "leader" as const, personId: newMindLeader.id },
  ];
  const users: Record<string, string> = {};
  for (const a of accounts) {
    const u = await ctx.internalAdapter.createUser({ ...a, displayUsername: a.username, active: true }, { method: "admin" });
    await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: hash });
    users[a.username] = u.id;
  }
  await db.insert(schema.userMinistryAccess).values({ userId: users.lider, ministryId: M["New Mind"] });

  /* ───────────── Cuidado pastoral (fictício) ───────────── */
  const pickMember = (f: (p: Draft) => boolean) => people.find((p) => p.status === "member" && f(p))!;
  const notes: [Draft, string, boolean][] = [
    [pickMember((p) => inMinistry(p, "Louvor") && age(p) >= 30), "Pediu oração pela saúde do esposo; não conseguiu servir no domingo.", true],
    [pickMember((p) => inMinistry(p, "Mídia")), "Entrou na escala da Mídia em novembro. Quer aprender transmissão.", false],
    [pickMember((p) => inMinistry(p, "New Mind") && age(p) <= 17), "Vai fazer o ENEM neste fim de semana. Combinamos de orar por ele no culto.", false],
    [pickMember((p) => inMinistry(p, "Metanoia")), "Voltou do acampamento muito tocado. Interessado no discipulado.", false],
    [pickMember((p) => inMinistry(p, "Casa de Paz") && p.householdRole === "head"), "Abriu a casa para a célula na próxima terça.", false],
  ];
  for (const [i, [p, text, pinned]] of notes.entries()) {
    await db.insert(schema.note).values({ personId: p.id, authorId: users.admin, content: text, pinned, createdAt: new Date(now - (i + 1) * 3 * 86_400_000) });
  }
  const away = people.filter((p) => p.engagement < 0);
  const firstVisitor = people.find((p) => p.status === "visitor")!;
  await db.insert(schema.followUp).values([
    { personId: away[0].id, title: "Ligar para saber como está", kind: "call", assigneeId: users.admin, createdById: users.admin, dueDate: addDaysIso(today, 1) },
    { personId: away[1].id, title: "Visita com a liderança da Casa de Paz", kind: "visit", assigneeId: users.secretaria, createdById: users.admin, dueDate: addDaysIso(today, 4) },
    { personId: firstVisitor.id, title: "Mensagem de boas-vindas", kind: "message", assigneeId: users.admin, createdById: users.admin, dueDate: today },
    { personId: notes[0][0].id, title: "Orar pela família no culto de quarta", kind: "prayer", assigneeId: users.admin, createdById: users.admin, dueDate: addDaysIso(today, 2) },
  ]);

  console.log(`Seed concluído (${CHURCH}): ${created.length} pessoas, ${households.length} famílias, ${all.length} encontros, ${records.length} registros de presença.`);
  console.log(`Contas: admin, secretaria, lider — senha: ${PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
