import { desc, gte } from "drizzle-orm";
import { CircleAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Metadata } from "next";
import { Section, StatCard } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/tone";
import { db, schema } from "@/db";
import { daysAgo, formatDateTime } from "@/lib/dates";
import { aiProvider } from "@/server/ai/agent";
import { TOOL_BY_NAME } from "@/server/ai/tools";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "IA" };

const usd = (v: number) => `US$ ${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;

export default async function AiOpsPage() {
  const settings = await getSettings();
  const provider = aiProvider();
  const since = daysAgo(30);
  const runs = await db.query.aiRun.findMany({
    where: gte(schema.aiRun.createdAt, since),
    with: { user: { columns: { name: true } } },
    orderBy: desc(schema.aiRun.createdAt),
  });

  const total = runs.length;
  const cost = runs.reduce((s, r) => s + r.costUsd, 0);
  const errors = runs.filter((r) => r.error).length;
  const latencies = runs.filter((r) => !r.error).map((r) => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const inputAll = runs.reduce((s, r) => s + r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0);
  const cacheHit = inputAll ? runs.reduce((s, r) => s + r.cacheReadTokens, 0) / inputAll : 0;
  const rated = runs.filter((r) => r.rating !== null);
  const good = rated.filter((r) => r.rating === 1).length;

  const toolStats = new Map<string, { calls: number; failed: number }>();
  for (const r of runs) {
    for (const t of r.toolCalls) {
      const s = toolStats.get(t.name) ?? { calls: 0, failed: 0 };
      s.calls++;
      if (!t.ok) s.failed++;
      toolStats.set(t.name, s);
    }
  }
  const tools = [...toolStats.entries()].sort((a, b) => b[1].calls - a[1].calls);
  const maxCalls = tools[0]?.[1].calls ?? 1;

  const byUser = new Map<string, { runs: number; cost: number }>();
  for (const r of runs) {
    const k = r.user?.name ?? "—";
    const s = byUser.get(k) ?? { runs: 0, cost: 0 };
    s.runs++;
    s.cost += r.costUsd;
    byUser.set(k, s);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {provider ? (
          <>
            {provider.label} · <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{provider.model}</code>
            <ToneBadge tone="sage">chave configurada</ToneBadge>
            {provider.price.input === 0 && <ToneBadge tone="gold">sem custo</ToneBadge>}
          </>
        ) : (
          <ToneBadge tone="rose">IA não configurada</ToneBadge>
        )}
        <span>· últimos 30 dias</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Perguntas" value={total} hint={`${errors} com erro (${total ? Math.round((errors / total) * 100) : 0}%)`} />
        <StatCard label="Custo estimado" value={usd(cost)} hint={total ? `${usd(cost / total)} por pergunta` : "—"} tone="gold" />
        <StatCard label="Tempo de resposta" value={`${(p50 / 1000).toFixed(1)}s`} hint={`p95 ${(p95 / 1000).toFixed(1)}s`} tone="sky" />
        <StatCard
          label="Satisfação"
          value={rated.length ? `${Math.round((good / rated.length) * 100)}%` : "—"}
          hint={`${rated.length} avaliações · cache ${Math.round(cacheHit * 100)}%`}
          tone="sage"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Ferramentas mais usadas" description="Quantas vezes a IA chamou cada ação">
          <ul className="space-y-2 px-5 pb-5">
            {tools.map(([name, s]) => (
              <li key={name} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{TOOL_BY_NAME.get(name)?.label ?? name}{TOOL_BY_NAME.get(name)?.write && <span className="ml-1.5 text-xs text-primary">escrita</span>}</span>
                  <span className="text-muted-foreground tabular">{s.calls}{s.failed > 0 && <span className="text-destructive"> · {s.failed} falhas</span>}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(s.calls / maxCalls) * 100}%` }} />
                </div>
              </li>
            ))}
            {tools.length === 0 && <li className="text-sm text-muted-foreground">Nenhuma chamada ainda.</li>}
          </ul>
        </Section>
        <Section title="Uso por pessoa">
          <ul className="divide-y border-t">
            {[...byUser.entries()].sort((a, b) => b[1].runs - a[1].runs).map(([name, s]) => (
              <li key={name} className="flex justify-between px-5 py-2.5 text-sm">
                <span>{name}</span>
                <span className="text-muted-foreground tabular">{s.runs} perguntas · {usd(s.cost)}</span>
              </li>
            ))}
            {byUser.size === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">—</li>}
          </ul>
        </Section>
      </div>

      <Section title="Execuções recentes" description="Cada pergunta, com ferramentas usadas, tokens, custo e avaliação">
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-4 py-2 font-medium">Quem</th>
                <th className="px-4 py-2 font-medium">Pergunta</th>
                <th className="px-4 py-2 font-medium">Ferramentas</th>
                <th className="px-4 py-2 text-right font-medium">Tokens (in/out)</th>
                <th className="px-4 py-2 text-right font-medium">Custo</th>
                <th className="px-4 py-2 text-right font-medium">Tempo</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.slice(0, 100).map((r) => (
                <tr key={r.id} className={r.error ? "bg-destructive/5" : undefined}>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt, settings.timezone)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.user?.name ?? "—"}</td>
                  <td className="max-w-72 truncate px-4 py-2" title={r.error ?? r.prompt}>{r.prompt}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.toolCalls.length ? `${r.toolCalls.length} (${r.toolCalls.filter((t) => t.write).length} escrita)` : "—"}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular text-muted-foreground">{(r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens).toLocaleString("pt-BR")} / {r.outputTokens.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular">{usd(r.costUsd)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular">{(r.latencyMs / 1000).toFixed(1)}s</td>
                  <td className="px-4 py-2">
                    {r.error ? <CircleAlert className="size-4 text-destructive" /> : r.rating === 1 ? <ThumbsUp className="size-4 text-success" /> : r.rating === -1 ? <ThumbsDown className="size-4 text-destructive" /> : null}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma pergunta nos últimos 30 dias.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
