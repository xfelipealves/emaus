import { CircleAlert, Download, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AiKpis, BarList, BudgetMeter, dayProgress, ErrorKinds, Satisfaction, StepTables, TokenMix, usd } from "@/components/app/ai-panels";
import { AiTrendCard, LatencyHistogram, UsageHeatmap } from "@/components/charts/ai-charts";
import { Section } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { aiProvider, availableProviders } from "@/server/ai/agent";
import { aiBudgetStatus } from "@/server/ai/budget";
import { aiInsights, badAnswers } from "@/server/ai/insights";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { AiSelector } from "./ai-selector";
import { ReviewButton } from "./review-button";

export const metadata: Metadata = { title: "IA" };

export default async function AiOpsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.churchId);
  const [provider, insights, budget, queue] = await Promise.all([
    aiProvider(user.churchId),
    aiInsights({ churchId: user.churchId, days: 30, timeZone: settings.timezone }),
    aiBudgetStatus(user.churchId),
    badAnswers(user.churchId),
  ]);
  const { runs } = insights;

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
      <AiSelector options={availableProviders()} active={settings.aiProvider} model={settings.aiModel} effort={settings.aiEffort} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Em uso agora:
        {provider ? (
          <>
            {provider.label} · <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{provider.model}</code>
            {provider.effort && provider.kind === "openai-responses" && <span>· esforço {provider.effort}</span>}
            <ToneBadge tone="sage">chave configurada</ToneBadge>
            {provider.price.input === 0 && <ToneBadge tone="gold">sem custo</ToneBadge>}
          </>
        ) : (
          <ToneBadge tone="rose">IA não configurada</ToneBadge>
        )}
        <span>· últimos 30 dias</span>
      </div>

      <AiKpis insights={insights} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <AiTrendCard daily={insights.daily} totals={insights.totals} />
        <Section title="Limite de hoje" description="Os tetos são definidos pela equipe do Emaús">
          <div className="space-y-4 px-5 pb-5">
            <BudgetMeter label="Igreja" line={budget.church} progress={dayProgress(settings.timezone)} />
            <BudgetMeter label="Por pessoa (teto)" line={{ spent: 0, cap: budget.user.cap }} />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TokenMix tokens={insights.tokens} cacheHit={insights.totals.cacheHit} />
        <Satisfaction totals={insights.totals} />
        <LatencyHistogram bins={insights.latencyBins} p50={insights.totals.p50} p95={insights.totals.p95} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <UsageHeatmap grid={insights.heatmap} />
        <Section title="Uso por pessoa" description="Quem mais pergunta ao assistente">
          <BarList
            empty="Ninguém usou o assistente no período."
            rows={[...byUser.entries()]
              .sort((a, b) => b[1].runs - a[1].runs)
              .map(([name, s]) => ({ key: name, label: name, value: s.runs, display: `${s.runs}`, note: usd(s.cost) }))}
          />
        </Section>
      </div>

      <StepTables tools={insights.tools} models={insights.models} />
      <ErrorKinds errors={insights.errorKinds} />

      <Section
        title="Respostas que não ajudaram"
        description="Cada 👎 vira um caso de avaliação: revise, ajuste e exporte para testar o assistente"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" render={<a href="/api/ia/avaliacoes?nota=ruim" />} nativeButton={false}>
              <Download data-icon="inline-start" /> 👎 (JSONL)
            </Button>
            <Button variant="outline" size="sm" render={<a href="/api/ia/avaliacoes" />} nativeButton={false}>
              <Download data-icon="inline-start" /> Todas
            </Button>
          </div>
        }
      >
        <ul className="divide-y border-t">
          {queue.map((r) => (
            <li key={r.id} className="space-y-1.5 px-5 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(r.createdAt, settings.timezone)} · {r.user?.name ?? "—"} · {r.model}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" render={<Link href={`/configuracoes/ia/${r.id}`} />} nativeButton={false}>
                    Ver execução
                  </Button>
                  <ReviewButton runId={r.id} />
                </div>
              </div>
              <p className="font-medium">{r.prompt}</p>
              {r.ratingNote && <p className="text-destructive">“{r.ratingNote}”</p>}
              {r.answer && <p className="line-clamp-3 text-muted-foreground">{r.answer}</p>}
            </li>
          ))}
          {queue.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Nenhuma avaliação negativa para revisar.</li>}
        </ul>
      </Section>

      <Section title="Execuções recentes" description="Abra uma execução para ver cada passo: modelo, ferramentas, tempo e custo">
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-4 py-2 font-medium">Quem</th>
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
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link href={`/configuracoes/ia/${r.id}`} className="text-primary hover:underline">
                      {formatDateTime(r.createdAt, settings.timezone)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.user?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.toolCalls.length ? `${r.toolCalls.length} (${r.toolCalls.filter((t) => t.write).length} escrita)` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular text-muted-foreground">
                    {(r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens).toLocaleString("pt-BR")} / {r.outputTokens.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular">{usd(r.costUsd)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap tabular">{(r.latencyMs / 1000).toFixed(1)}s</td>
                  <td className="px-4 py-2" title={r.error ?? undefined}>
                    {r.error ? (
                      <CircleAlert className="size-4 text-destructive" />
                    ) : r.rating === 1 ? (
                      <ThumbsUp className="size-4 text-success" />
                    ) : r.rating === -1 ? (
                      <ThumbsDown className="size-4 text-destructive" />
                    ) : null}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma pergunta nos últimos 30 dias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
