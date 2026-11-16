import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysIso, isoDateInTz, todayIso } from "@/lib/dates";

/** Percentil de uma lista já ordenada. */
function percentile(sorted: number[], p: number) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
}

type LatencyStats = { calls: number; failed: number; p50: number; p95: number };

function latencyStats(items: { latencyMs: number; ok: boolean }[]): LatencyStats {
  const sorted = items.filter((i) => i.ok).map((i) => i.latencyMs).sort((a, b) => a - b);
  return { calls: items.length, failed: items.filter((i) => !i.ok).length, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) };
}

/** Faixas do histograma de tempo de resposta, em segundos (a última é aberta). */
export const LATENCY_BINS = [0, 2, 4, 8, 15, 30] as const;

/** Dia da semana (0 = domingo) e hora no fuso da igreja, para o mapa de uso. */
function weekdayHour(date: Date, fmt: Intl.DateTimeFormat) {
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { weekday, hour: Number(parts.hour) % 24 };
}

/** Resumo comparável entre dois períodos (para as variações dos indicadores). */
function summarize(runs: { costUsd: number; latencyMs: number; error: string | null; rating: number | null }[]) {
  const ok = runs.filter((r) => !r.error).map((r) => r.latencyMs).sort((a, b) => a - b);
  const rated = runs.filter((r) => r.rating !== null);
  return {
    runs: runs.length,
    cost: runs.reduce((s, r) => s + r.costUsd, 0),
    errors: runs.length - ok.length,
    p50: percentile(ok, 0.5),
    p95: percentile(ok, 0.95),
    rated: rated.length,
    good: rated.filter((r) => r.rating === 1).length,
  };
}

/**
 * Painel de IA dos últimos N dias: de uma igreja (`churchId`) ou da plataforma toda.
 * Volume pequeno (uma linha por pergunta e por passo): agrega em memória.
 */
export async function aiInsights(opts: { churchId?: string; days: number; timeZone: string }) {
  const since = new Date(Date.now() - opts.days * 86_400_000);
  const prevSince = new Date(since.getTime() - opts.days * 86_400_000);
  const scope = opts.churchId;
  const [runs, steps, prevRuns] = await Promise.all([
    db.query.aiRun.findMany({
      where: and(gte(schema.aiRun.createdAt, since), scope ? eq(schema.aiRun.churchId, scope) : undefined),
      columns: { prompt: false, answer: false, ratingNote: false },
      with: { user: { columns: { name: true } } },
      orderBy: desc(schema.aiRun.createdAt),
    }),
    db.query.aiStep.findMany({
      where: and(gte(schema.aiStep.createdAt, since), scope ? eq(schema.aiStep.churchId, scope) : undefined),
      columns: { kind: true, name: true, latencyMs: true, ok: true, write: true, error: true, costUsd: true },
    }),
    // Período anterior, do mesmo tamanho: só o necessário para comparar.
    db.query.aiRun.findMany({
      where: and(gte(schema.aiRun.createdAt, prevSince), lt(schema.aiRun.createdAt, since), scope ? eq(schema.aiRun.churchId, scope) : undefined),
      columns: { costUsd: true, latencyMs: true, error: true, rating: true },
    }),
  ]);

  const done = runs.filter((r) => r.latencyMs > 0 || r.error);
  const current = summarize(runs);
  const tokens = {
    fresh: runs.reduce((s, r) => s + r.inputTokens, 0),
    cacheRead: runs.reduce((s, r) => s + r.cacheReadTokens, 0),
    cacheWrite: runs.reduce((s, r) => s + r.cacheWriteTokens, 0),
    output: runs.reduce((s, r) => s + r.outputTokens, 0),
  };
  const inputAll = tokens.fresh + tokens.cacheRead + tokens.cacheWrite;

  // Um ponto por dia, inclusive os dias sem uso.
  const today = todayIso(opts.timeZone);
  const days = new Map<string, typeof runs>();
  for (let i = opts.days - 1; i >= 0; i--) days.set(addDaysIso(today, -i), []);
  for (const r of runs) days.get(isoDateInTz(r.createdAt, opts.timeZone))?.push(r);
  const daily = [...days.entries()].map(([day, items]) => {
    const s = summarize(items);
    return { day, runs: s.runs, ok: s.runs - s.errors, errors: s.errors, cost: s.cost, p50: s.p50, p95: s.p95, good: s.good, rated: s.rated };
  });

  // Histograma do tempo de resposta (só execuções que terminaram bem).
  const latencyBins = LATENCY_BINS.map((from, i) => ({ from, to: LATENCY_BINS[i + 1] ?? null, runs: 0 }));
  for (const r of runs) {
    if (r.error || r.latencyMs <= 0) continue;
    const secs = r.latencyMs / 1000;
    latencyBins.findLast((b) => secs >= b.from)!.runs++;
  }

  // Mapa de uso: dia da semana × hora, no fuso da igreja (ou de Brasília, na plataforma).
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: opts.timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" });
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of runs) {
    const { weekday, hour } = weekdayHour(r.createdAt, fmt);
    if (weekday >= 0) heatmap[weekday][hour]++;
  }

  const group = <T,>(items: T[], key: (i: T) => string) => [...Map.groupBy(items, key).entries()];
  const tools = group(steps.filter((s) => s.kind === "tool"), (s) => s.name)
    .map(([name, items]) => ({ name, write: items.some((i) => i.write), ...latencyStats(items) }))
    .sort((a, b) => b.calls - a.calls);
  const models = group(steps.filter((s) => s.kind === "model"), (s) => s.name)
    .map(([name, items]) => ({ name, cost: items.reduce((s, i) => s + i.costUsd, 0), ...latencyStats(items) }))
    .sort((a, b) => b.calls - a.calls);
  // Erros agrupados pela mensagem: mostra o que mais quebra, sem expor perguntas.
  const errorKinds = group(
    steps.filter((s) => !s.ok && s.error),
    (s) => `${s.kind === "model" ? "Modelo" : "Ferramenta"} ${s.name}: ${s.error}`,
  )
    .map(([label, items]) => ({ label, count: items.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    runs,
    totals: {
      ...current,
      finished: done.length,
      cacheHit: inputAll ? tokens.cacheRead / inputAll : 0,
      bad: current.rated - current.good,
    },
    previous: summarize(prevRuns),
    tokens,
    daily,
    latencyBins,
    heatmap,
    tools,
    models,
    errorKinds,
  };
}

/** Respostas com 👎 ainda sem revisão: a fila que vira casos de avaliação. */
export async function badAnswers(churchId: string, opts: { reviewed?: boolean; limit?: number } = {}) {
  return db.query.aiRun.findMany({
    where: and(
      eq(schema.aiRun.churchId, churchId),
      eq(schema.aiRun.rating, -1),
      opts.reviewed ? undefined : isNull(schema.aiRun.reviewedAt),
    ),
    with: { user: { columns: { name: true } } },
    orderBy: desc(schema.aiRun.createdAt),
    limit: opts.limit ?? 50,
  });
}

/** Casos de avaliação (JSONL): pergunta, resposta dada e o veredito de quem usou. */
export async function evalCases(churchId: string, rating: 1 | -1 | null) {
  const runs = await db.query.aiRun.findMany({
    where: and(
      eq(schema.aiRun.churchId, churchId),
      // Só execuções avaliadas e terminadas sem erro.
      rating === null ? isNotNull(schema.aiRun.rating) : eq(schema.aiRun.rating, rating),
      isNull(schema.aiRun.error),
    ),
    orderBy: desc(schema.aiRun.createdAt),
    limit: 1000,
  });
  return runs.map((r) => ({
    id: r.id,
    created_at: r.createdAt.toISOString(),
    model: r.model,
    prompt: r.prompt,
    answer: r.answer,
    tools: r.toolCalls.map((t) => t.name),
    rating: r.rating === 1 ? "good" : "bad",
    note: r.ratingNote,
  }));
}
