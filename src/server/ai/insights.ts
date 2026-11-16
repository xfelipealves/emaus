import "server-only";
import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
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

/**
 * Painel de IA dos últimos N dias: de uma igreja (`churchId`) ou da plataforma toda.
 * Volume pequeno (uma linha por pergunta e por passo): agrega em memória.
 */
export async function aiInsights(opts: { churchId?: string; days: number; timeZone: string }) {
  const since = new Date(Date.now() - opts.days * 86_400_000);
  const scope = opts.churchId;
  const [runs, steps] = await Promise.all([
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
  ]);

  const done = runs.filter((r) => r.latencyMs > 0 || r.error);
  const cost = runs.reduce((s, r) => s + r.costUsd, 0);
  const errors = runs.filter((r) => r.error).length;
  const latencies = runs.filter((r) => !r.error).map((r) => r.latencyMs).sort((a, b) => a - b);
  const inputAll = runs.reduce((s, r) => s + r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0);
  const rated = runs.filter((r) => r.rating !== null);

  // Uma barra por dia, inclusive os dias sem uso.
  const today = todayIso(opts.timeZone);
  const daily = new Map<string, { day: string; runs: number; cost: number; errors: number }>();
  for (let i = opts.days - 1; i >= 0; i--) {
    const day = addDaysIso(today, -i);
    daily.set(day, { day, runs: 0, cost: 0, errors: 0 });
  }
  for (const r of runs) {
    const d = daily.get(isoDateInTz(r.createdAt, opts.timeZone));
    if (!d) continue;
    d.runs++;
    d.cost += r.costUsd;
    if (r.error) d.errors++;
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
      runs: runs.length,
      finished: done.length,
      cost,
      errors,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      cacheHit: inputAll ? runs.reduce((s, r) => s + r.cacheReadTokens, 0) / inputAll : 0,
      rated: rated.length,
      good: rated.filter((r) => r.rating === 1).length,
      bad: rated.filter((r) => r.rating === -1).length,
    },
    daily: [...daily.values()],
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
