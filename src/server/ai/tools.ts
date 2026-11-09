import "server-only";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { PERSON_STATUSES } from "@/db/schema";
import {
  addDaysIso,
  daysUntilBirthday,
  formatDate,
  formatDateTime,
  isoDateInTz,
  startOfDayUtc,
  todayIso,
} from "@/lib/dates";
import { FOLLOW_UP_KIND_LABEL, STATUS_LABEL } from "@/lib/labels";
import { displayName, formatPhone } from "@/lib/text";
import { completeFollowUp, createFollowUp, addNote, listFollowUps } from "../care";
import { dashboardData } from "../dashboard";
import {
  attendanceRoster,
  createEvent,
  getEvent,
  listEvents,
  setAttendance,
  setEventCancelled,
} from "../events";
import { recordAudit } from "../history";
import { listHouseholds } from "../households";
import { addMember, endMembership, getMinistry, listMinistries } from "../ministries";
import {
  changeStatus,
  createPerson,
  deletePerson,
  getPerson,
  listPeople,
  peopleNeedingCare,
  personAttendance,
  updatePerson,
} from "../people";
import { ActionError, can, type CurrentUser, visiblePersonIds } from "../session";
import { getSettings } from "../settings";

export type ToolContext = { user: CurrentUser; conversationId: string | null };

export type AiTool = {
  name: string;
  label: string;
  description: string;
  schema: z.ZodObject;
  /** Altera dados: registrado na auditoria como "via assistente". */
  write: boolean;
  run: (input: never, ctx: ToolContext) => Promise<unknown>;
};

function tool<S extends z.ZodObject>(def: {
  name: string;
  label: string;
  description: string;
  schema: S;
  write?: boolean;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}): AiTool {
  return { ...def, write: def.write ?? false, run: def.run as AiTool["run"] };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD");
const personLink = (p: { id: string; fullName: string; preferredName?: string | null }) =>
  `[${displayName(p)}](/pessoas/${p.id})`;

async function tz() {
  return (await getSettings()).timezone;
}

/* ───────────────────────── Leitura ───────────────────────── */

const buscarPessoas = tool({
  name: "buscar_pessoas",
  label: "Buscou pessoas",
  description:
    "Busca pessoas da igreja por nome/apelido/telefone e filtra por status ou ministério. Sem filtros, lista todas. Retorna id, nome, status, idade, telefone, ministérios e dias desde a última presença.",
  schema: z.object({
    texto: z.string().optional().describe("Parte do nome, apelido ou telefone"),
    status: z.enum(PERSON_STATUSES).optional().describe("visitor, member ou inactive"),
    ministerio_id: z.string().optional(),
    limite: z.number().int().min(1).max(300).optional().describe("Padrão 50"),
  }),
  run: async ({ texto, status, ministerio_id, limite }, { user }) => {
    const people = await listPeople(user, { q: texto, status, ministryId: ministerio_id });
    return {
      total: people.length,
      pessoas: people.slice(0, limite ?? 50).map((p) => ({
        id: p.id,
        nome: displayName(p),
        nome_completo: p.fullName,
        status: STATUS_LABEL[p.status],
        idade: p.age,
        telefone: formatPhone(p.phone),
        familia: p.householdName,
        ministerios: p.ministries.map((m) => `${m.name}${m.role === "leader" ? " (líder)" : ""}`),
        dias_sem_presenca: p.daysSinceSeen,
        presencas_total: p.visits,
        link: personLink(p),
      })),
    };
  },
});

const detalhesPessoa = tool({
  name: "detalhes_pessoa",
  label: "Abriu o perfil",
  description:
    "Perfil completo de uma pessoa: dados, família, ministérios, últimas presenças, acompanhamentos abertos e anotações.",
  schema: z.object({ pessoa_id: z.string() }),
  run: async ({ pessoa_id }, { user }) => {
    const p = await getPerson(user, pessoa_id);
    if (!p) throw new ActionError("Pessoa não encontrada ou fora do seu acesso.");
    const zone = await tz();
    const [attendance, followUps, notes] = await Promise.all([
      personAttendance(pessoa_id, 15),
      listFollowUps(user, { personId: pessoa_id }),
      db.query.note.findMany({
        where: and(
          eq(schema.note.personId, pessoa_id),
          user.role === "admin" ? undefined : eq(schema.note.visibility, "team"),
        ),
        with: { author: { columns: { name: true } } },
        orderBy: desc(schema.note.createdAt),
        limit: 10,
      }),
    ]);
    return {
      id: p.id,
      nome: p.fullName,
      apelido: p.preferredName,
      status: STATUS_LABEL[p.status],
      idade: p.age,
      nascimento: p.birthDate,
      telefone: formatPhone(p.phone),
      email: p.email,
      endereco: p.address,
      primeira_visita: p.firstVisitDate,
      membro_desde: p.memberSince,
      familia: p.household ? { id: p.household.id, nome: p.household.name, membros: p.household.members.map((m) => displayName(m)) } : null,
      ministerios: p.memberships.map((m) => ({
        vinculo_id: m.id,
        ministerio: m.ministry.name,
        funcao: m.role === "leader" ? "líder" : "participante",
        desde: m.startDate,
        ate: m.endDate,
      })),
      ultimas_presencas: attendance.map((a) => ({
        encontro: a.title,
        quando: formatDateTime(a.startsAt, zone),
        status: a.status === "present" ? "presente" : "ausente",
      })),
      acompanhamentos_abertos: followUps.map((f) => ({ id: f.id, titulo: f.title, tipo: FOLLOW_UP_KIND_LABEL[f.kind], prazo: f.dueDate, responsavel: f.assignee?.name })),
      anotacoes: notes.map((n) => ({
        texto: n.content,
        autor: n.author?.name,
        quando: formatDate(n.createdAt, zone),
        confidencial: n.visibility === "pastoral",
      })),
      link: personLink(p),
    };
  },
});

const listarMinisterios = tool({
  name: "listar_ministerios",
  label: "Consultou ministérios",
  description: "Lista os ministérios com id, descrição, número de participantes e líderes.",
  schema: z.object({}),
  run: async (_input, { user }) => {
    const ministries = await listMinistries(user);
    return ministries.map((m) => ({
      id: m.id,
      nome: m.name,
      descricao: m.description,
      participantes: m.memberCount,
      lideres: m.leaders.map((l) => displayName(l)),
      link: `[${m.name}](/ministerios/${m.id})`,
    }));
  },
});

const detalhesMinisterio = tool({
  name: "detalhes_ministerio",
  label: "Abriu o ministério",
  description: "Participantes atuais de um ministério (com id do vínculo e função).",
  schema: z.object({ ministerio_id: z.string() }),
  run: async ({ ministerio_id }, { user }) => {
    const m = await getMinistry(user, ministerio_id);
    if (!m) throw new ActionError("Ministério não encontrado ou fora do seu acesso.");
    return {
      id: m.id,
      nome: m.name,
      participantes: m.memberships
        .filter((x) => !x.endDate)
        .map((x) => ({ vinculo_id: x.id, pessoa_id: x.person.id, nome: displayName(x.person), funcao: x.role === "leader" ? "líder" : "participante", desde: x.startDate })),
    };
  },
});

const listarEncontros = tool({
  name: "listar_encontros",
  label: "Consultou a agenda",
  description:
    "Lista encontros (cultos, células, eventos) num intervalo de datas, com id, horário, público, se foi cancelado e quantos presentes.",
  schema: z.object({
    de: isoDate.describe("Data inicial (AAAA-MM-DD)"),
    ate: isoDate.describe("Data final, inclusiva (AAAA-MM-DD)"),
  }),
  run: async ({ de, ate }, { user }) => {
    const zone = await tz();
    const events = await listEvents(user, { from: startOfDayUtc(de, zone), to: startOfDayUtc(addDaysIso(ate, 1), zone) });
    return events.map((e) => ({
      id: e.id,
      titulo: e.title,
      quando: formatDateTime(e.startsAt, zone),
      data: isoDateInTz(e.startsAt, zone),
      categoria: e.category?.name,
      publico: e.audience.length ? e.audience.map((a) => a.ministry.name) : ["Igreja toda"],
      cancelado: e.cancelled,
      presentes: e.present,
      link: `[${e.title}](/encontros/${e.id})`,
    }));
  },
});

const presencaEncontro = tool({
  name: "presenca_encontro",
  label: "Abriu a chamada",
  description:
    "Chamada de um encontro: quem esteve presente, quem foi marcado ausente e quem ainda está pendente (só público do encontro).",
  schema: z.object({ encontro_id: z.string() }),
  run: async ({ encontro_id }, { user }) => {
    const ev = await getEvent(user, encontro_id);
    if (!ev) throw new ActionError("Encontro não encontrado ou fora do seu acesso.");
    const roster = await attendanceRoster(user, encontro_id);
    const pick = (s: "present" | "absent" | null) =>
      roster.filter((r) => r.attendance === s && (s !== null || r.inAudience)).map((r) => ({ id: r.id, nome: displayName(r) }));
    return {
      encontro: ev.title,
      quando: formatDateTime(ev.startsAt, await tz()),
      cancelado: ev.cancelled,
      presentes: pick("present"),
      ausentes: pick("absent"),
      pendentes: pick(null),
    };
  },
});

const panorama = tool({
  name: "panorama",
  label: "Viu o panorama",
  description:
    "Números gerais: pessoas ativas, membros, visitantes, média semanal de presença (últimas 4 semanas e variação), visitantes novos e tendência semanal de 12 semanas.",
  schema: z.object({}),
  run: async (_input, { user }) => {
    const d = await dashboardData(user);
    return {
      contagens: d.counts,
      media_semanal: d.attendance.avgNow,
      variacao_vs_4_semanas_antes: d.attendance.delta,
      tendencia_semanal: d.trend,
      precisam_de_cuidado: d.careTotal,
    };
  },
});

const precisamDeCuidado = tool({
  name: "pessoas_sumidas",
  label: "Viu quem sumiu",
  description: "Pessoas ativas sem presença há mais dias que o limite de cuidado da igreja, e se já há acompanhamento.",
  schema: z.object({}),
  run: async (_input, { user }) => {
    const settings = await getSettings();
    const care = await peopleNeedingCare(user);
    return {
      limite_dias: settings.careThresholdDays,
      pessoas: care.map((p) => ({
        id: p.id,
        nome: displayName(p),
        status: STATUS_LABEL[p.status],
        dias_sem_presenca: p.absentDays,
        nunca_registrou_presenca: p.neverSeen,
        tem_acompanhamento: p.hasFollowUp,
        telefone: formatPhone(p.phone),
        link: personLink(p),
      })),
    };
  },
});

const aniversariantes = tool({
  name: "aniversariantes",
  label: "Viu aniversariantes",
  description: "Aniversariantes nos próximos N dias (padrão 7).",
  schema: z.object({ dias: z.number().int().min(0).max(366).optional() }),
  run: async ({ dias }, { user }) => {
    const zone = await tz();
    const today = todayIso(zone);
    const people = await listPeople(user);
    return people
      .filter((p) => p.birthDate && p.status !== "inactive")
      .map((p) => ({ p, em: daysUntilBirthday(p.birthDate!, today) }))
      .filter((x) => x.em <= (dias ?? 7))
      .sort((a, b) => a.em - b.em)
      .map(({ p, em }) => ({ nome: displayName(p), data: p.birthDate!.slice(5), faz: (p.age ?? 0) + (em === 0 ? 0 : 1), em_dias: em, telefone: formatPhone(p.phone), link: personLink(p) }));
  },
});

const listarAcompanhamentos = tool({
  name: "listar_acompanhamentos",
  label: "Viu acompanhamentos",
  description: "Acompanhamentos pastorais (ligar, visitar, orar…). Por padrão os abertos de todos; use 'meus' para só os do usuário.",
  schema: z.object({
    concluidos: z.boolean().optional(),
    meus: z.boolean().optional(),
  }),
  run: async ({ concluidos, meus }, { user }) => {
    const rows = await listFollowUps(user, { done: concluidos, assigneeId: meus ? user.id : undefined });
    return rows.map((f) => ({
      id: f.id,
      titulo: f.title,
      tipo: FOLLOW_UP_KIND_LABEL[f.kind],
      pessoa: f.person ? personLink(f.person) : null,
      responsavel: f.assignee?.name,
      prazo: f.dueDate,
      concluido_em: f.doneAt ? formatDate(f.doneAt) : null,
      resultado: f.outcome,
    }));
  },
});

const buscarAnotacoes = tool({
  name: "buscar_anotacoes",
  label: "Pesquisou anotações",
  description: "Procura um termo no texto das anotações pastorais (ex.: 'oração', 'emprego', 'hospital').",
  schema: z.object({ termo: z.string().min(2) }),
  run: async ({ termo }, { user }) => {
    const visible = await visiblePersonIds(user);
    const rows = await db
      .select({
        content: schema.note.content,
        createdAt: schema.note.createdAt,
        visibility: schema.note.visibility,
        personId: schema.person.id,
        fullName: schema.person.fullName,
        preferredName: schema.person.preferredName,
      })
      .from(schema.note)
      .innerJoin(schema.person, eq(schema.person.id, schema.note.personId))
      .where(
        and(
          like(sql`lower(${schema.note.content})`, `%${termo.toLowerCase()}%`),
          user.role === "admin" ? undefined : eq(schema.note.visibility, "team"),
          visible ? inArray(schema.person.id, [...visible]) : undefined,
        ),
      )
      .orderBy(desc(schema.note.createdAt))
      .limit(30);
    return rows.map((r) => ({
      pessoa: personLink({ id: r.personId, fullName: r.fullName, preferredName: r.preferredName }),
      texto: r.content,
      quando: formatDate(r.createdAt),
      confidencial: r.visibility === "pastoral",
    }));
  },
});

const listarFamilias = tool({
  name: "listar_familias",
  label: "Consultou famílias",
  description: "Famílias cadastradas com seus membros.",
  schema: z.object({ texto: z.string().optional().describe("Parte do nome da família") }),
  run: async ({ texto }, { user }) => {
    const houses = await listHouseholds(user);
    return houses
      .filter((h) => !texto || h.name.toLowerCase().includes(texto.toLowerCase()))
      .slice(0, 40)
      .map((h) => ({ id: h.id, nome: h.name, membros: h.members.map((m) => `${displayName(m)} (${STATUS_LABEL[m.status]})`) }));
  },
});

/* ───────────────────────── Escrita ───────────────────────── */

async function audit(ctx: ToolContext, action: string, summary: string, after?: unknown) {
  await recordAudit(db, {
    actorId: ctx.user.id,
    entity: "assistant",
    entityId: ctx.conversationId ?? "-",
    action,
    summary: `Via assistente: ${summary}`,
    after,
  });
}

const cadastrarPessoa = tool({
  name: "cadastrar_pessoa",
  label: "Cadastrou pessoa",
  write: true,
  description: "Cadastra uma pessoa nova. Antes, use buscar_pessoas para evitar duplicidade.",
  schema: z.object({
    nome_completo: z.string().min(2),
    status: z.enum(PERSON_STATUSES).optional().describe("Padrão visitor"),
    apelido: z.string().optional(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    nascimento: isoDate.optional(),
    endereco: z.string().optional(),
    como_conheceu: z.string().optional(),
  }),
  run: async (i, ctx) => {
    const p = await createPerson(ctx.user, {
      fullName: i.nome_completo,
      status: i.status ?? "visitor",
      preferredName: i.apelido,
      phone: i.telefone,
      email: i.email,
      birthDate: i.nascimento,
      address: i.endereco,
      howFound: i.como_conheceu,
    });
    await audit(ctx, "person.create", `cadastrou ${p.fullName}`);
    return { ok: true, id: p.id, link: personLink(p) };
  },
});

const atualizarPessoa = tool({
  name: "atualizar_pessoa",
  label: "Atualizou cadastro",
  write: true,
  description: "Atualiza dados de cadastro (só os campos informados). Para status, use mudar_status.",
  schema: z.object({
    pessoa_id: z.string(),
    nome_completo: z.string().min(2).optional(),
    apelido: z.string().optional(),
    telefone: z.string().optional(),
    email: z.string().optional(),
    nascimento: isoDate.optional(),
    endereco: z.string().optional(),
  }),
  run: async (i, ctx) => {
    const p = await getPerson(ctx.user, i.pessoa_id);
    if (!p) throw new ActionError("Pessoa não encontrada ou fora do seu acesso.");
    const merged = {
      fullName: i.nome_completo ?? p.fullName,
      preferredName: i.apelido ?? p.preferredName ?? undefined,
      status: p.status,
      gender: p.gender ?? undefined,
      phone: i.telefone ?? p.phone ?? undefined,
      email: i.email ?? p.email ?? undefined,
      birthDate: i.nascimento ?? p.birthDate ?? undefined,
      address: i.endereco ?? p.address ?? undefined,
      firstVisitDate: p.firstVisitDate ?? undefined,
      memberSince: p.memberSince ?? undefined,
      howFound: p.howFound ?? undefined,
      householdId: p.householdId ?? undefined,
      householdRole: p.householdRole ?? undefined,
    };
    await updatePerson(ctx.user, i.pessoa_id, merged);
    await audit(ctx, "person.update", `atualizou o cadastro de ${merged.fullName}`, i);
    return { ok: true, link: personLink({ id: p.id, fullName: merged.fullName }) };
  },
});

const mudarStatus = tool({
  name: "mudar_status",
  label: "Mudou status",
  write: true,
  description: "Muda o status de uma pessoa (visitante, membro, inativo), registrando o motivo.",
  schema: z.object({ pessoa_id: z.string(), status: z.enum(PERSON_STATUSES), motivo: z.string().optional() }),
  run: async ({ pessoa_id, status, motivo }, ctx) => {
    await changeStatus(ctx.user, pessoa_id, status, motivo);
    await audit(ctx, "person.status", `mudou status para ${STATUS_LABEL[status]}`, { pessoa_id, motivo });
    return { ok: true };
  },
});

const registrarPresenca = tool({
  name: "registrar_presenca",
  label: "Registrou presença",
  write: true,
  description:
    "Marca presença ou ausência de uma ou mais pessoas num encontro. status 'limpar' remove o registro. Use listar_encontros para achar o encontro.",
  schema: z.object({
    encontro_id: z.string(),
    pessoa_ids: z.array(z.string()).min(1).max(300),
    status: z.enum(["presente", "ausente", "limpar"]),
  }),
  run: async ({ encontro_id, pessoa_ids, status }, ctx) => {
    const mapped = status === "presente" ? "present" : status === "ausente" ? "absent" : null;
    const errors: string[] = [];
    for (const id of pessoa_ids) {
      try {
        await setAttendance(ctx.user, encontro_id, id, mapped);
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    await audit(ctx, "attendance.bulk", `marcou ${pessoa_ids.length - errors.length} pessoa(s) como ${status}`, { encontro_id });
    return { ok: errors.length === 0, registrados: pessoa_ids.length - errors.length, erros: errors };
  },
});

const adicionarAnotacao = tool({
  name: "adicionar_anotacao",
  label: "Escreveu anotação",
  write: true,
  description: "Adiciona uma anotação pastoral ao perfil. confidencial=true só para administradores (pastores).",
  schema: z.object({ pessoa_id: z.string(), texto: z.string().min(2), confidencial: z.boolean().optional() }),
  run: async ({ pessoa_id, texto, confidencial }, ctx) => {
    await addNote(ctx.user, pessoa_id, texto, confidencial ?? false);
    await audit(ctx, "note.create", "adicionou uma anotação", { pessoa_id });
    return { ok: true };
  },
});

const criarAcompanhamento = tool({
  name: "criar_acompanhamento",
  label: "Criou acompanhamento",
  write: true,
  description: "Cria um lembrete de cuidado pastoral para uma pessoa (ligar, visitar, mensagem, orar).",
  schema: z.object({
    pessoa_id: z.string(),
    titulo: z.string().min(2),
    tipo: z.enum(["call", "visit", "message", "prayer", "other"]).optional(),
    prazo: isoDate.optional(),
    responsavel_id: z.string().optional().describe("id do usuário; padrão: quem pediu"),
  }),
  run: async (i, ctx) => {
    await createFollowUp(ctx.user, { personId: i.pessoa_id, title: i.titulo, kind: i.tipo ?? "call", dueDate: i.prazo, assigneeId: i.responsavel_id });
    await audit(ctx, "followup.create", `criou acompanhamento "${i.titulo}"`, { pessoa_id: i.pessoa_id });
    return { ok: true };
  },
});

const concluirAcompanhamento = tool({
  name: "concluir_acompanhamento",
  label: "Concluiu acompanhamento",
  write: true,
  description: "Marca um acompanhamento como concluído, com o resultado.",
  schema: z.object({ acompanhamento_id: z.string(), resultado: z.string().optional() }),
  run: async ({ acompanhamento_id, resultado }, ctx) => {
    await completeFollowUp(ctx.user, acompanhamento_id, resultado);
    await audit(ctx, "followup.done", "concluiu um acompanhamento");
    return { ok: true };
  },
});

const adicionarAoMinisterio = tool({
  name: "adicionar_ao_ministerio",
  label: "Adicionou ao ministério",
  write: true,
  description: "Adiciona uma pessoa a um ministério como participante ou líder.",
  schema: z.object({ pessoa_id: z.string(), ministerio_id: z.string(), funcao: z.enum(["member", "leader"]).optional() }),
  run: async ({ pessoa_id, ministerio_id, funcao }, ctx) => {
    await addMember(ctx.user, ministerio_id, pessoa_id, funcao ?? "member");
    await audit(ctx, "membership.create", "adicionou pessoa a ministério", { pessoa_id, ministerio_id });
    return { ok: true };
  },
});

const removerDoMinisterio = tool({
  name: "remover_do_ministerio",
  label: "Encerrou vínculo",
  write: true,
  description: "Encerra o vínculo de uma pessoa com um ministério (fica no histórico). Use o vinculo_id de detalhes_pessoa ou detalhes_ministerio.",
  schema: z.object({ vinculo_id: z.string() }),
  run: async ({ vinculo_id }, ctx) => {
    await endMembership(ctx.user, vinculo_id);
    await audit(ctx, "membership.end", "encerrou um vínculo de ministério", { vinculo_id });
    return { ok: true };
  },
});

const criarEncontro = tool({
  name: "criar_encontro",
  label: "Criou encontro",
  write: true,
  description: "Cria um encontro avulso ou recorrente. Para público restrito, informe ids de ministérios.",
  schema: z.object({
    titulo: z.string().min(2),
    data: isoDate,
    hora: z.string().regex(/^\d{2}:\d{2}$/).describe("HH:mm"),
    duracao_minutos: z.number().int().min(15).max(1440).optional(),
    local: z.string().optional(),
    ministerio_ids: z.array(z.string()).optional(),
    recorrencia: z.enum(["none", "weekly", "biweekly", "monthly"]).optional(),
    ate: isoDate.optional(),
    descricao: z.string().optional(),
  }),
  run: async (i, ctx) => {
    if (!can.manageEvents(ctx.user)) throw new ActionError("Seu papel não permite criar encontros.");
    const ev = await createEvent(ctx.user, {
      title: i.titulo,
      date: i.data,
      time: i.hora,
      durationMinutes: i.duracao_minutos ?? 120,
      location: i.local,
      ministryIds: i.ministerio_ids ?? [],
      recurrence: i.recorrencia ?? "none",
      until: i.ate,
      description: i.descricao,
    });
    await audit(ctx, "event.create", `criou o encontro "${i.titulo}"`);
    return { ok: true, id: ev.id, link: `[${ev.title}](/encontros/${ev.id})` };
  },
});

const cancelarEncontro = tool({
  name: "cancelar_encontro",
  label: "Cancelou encontro",
  write: true,
  description: "Cancela (ou reativa, com reativar=true) um encontro.",
  schema: z.object({ encontro_id: z.string(), reativar: z.boolean().optional() }),
  run: async ({ encontro_id, reativar }, ctx) => {
    if (!can.manageEvents(ctx.user)) throw new ActionError("Seu papel não permite cancelar encontros.");
    await setEventCancelled(ctx.user, encontro_id, !reativar);
    await audit(ctx, reativar ? "event.restore" : "event.cancel", reativar ? "reativou um encontro" : "cancelou um encontro", { encontro_id });
    return { ok: true };
  },
});

const excluirPessoa = tool({
  name: "excluir_pessoa",
  label: "Excluiu cadastro",
  write: true,
  description:
    "Exclui definitivamente um cadastro e todo o histórico. SÓ chame depois que o usuário confirmar explicitamente nesta conversa; passe confirmado=true. Para quem só se afastou, prefira mudar_status para inativo.",
  schema: z.object({ pessoa_id: z.string(), confirmado: z.literal(true) }),
  run: async ({ pessoa_id }, ctx) => {
    if (!can.deletePeople(ctx.user)) throw new ActionError("Só administradores excluem cadastros.");
    const p = await getPerson(ctx.user, pessoa_id);
    await deletePerson(ctx.user, pessoa_id);
    await audit(ctx, "person.delete", `excluiu o cadastro de ${p?.fullName ?? pessoa_id}`);
    return { ok: true };
  },
});

export const AI_TOOLS: AiTool[] = [
  buscarPessoas,
  detalhesPessoa,
  listarMinisterios,
  detalhesMinisterio,
  listarEncontros,
  presencaEncontro,
  panorama,
  precisamDeCuidado,
  aniversariantes,
  listarAcompanhamentos,
  buscarAnotacoes,
  listarFamilias,
  cadastrarPessoa,
  atualizarPessoa,
  mudarStatus,
  registrarPresenca,
  adicionarAnotacao,
  criarAcompanhamento,
  concluirAcompanhamento,
  adicionarAoMinisterio,
  removerDoMinisterio,
  criarEncontro,
  cancelarEncontro,
  excluirPessoa,
];

export const TOOL_BY_NAME = new Map(AI_TOOLS.map((t) => [t.name, t]));
