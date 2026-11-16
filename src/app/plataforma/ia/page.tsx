import type { Metadata } from "next";
import { AiKpis, BarList, BudgetMeter, dayProgress, ErrorKinds, Satisfaction, StepTables, TokenMix, usd } from "@/components/app/ai-panels";
import { AiTrendCard, LatencyHistogram, UsageHeatmap } from "@/components/charts/ai-charts";
import { PageHeader, Section } from "@/components/app/page-header";
import { PLATFORM_TIMEZONE } from "@/server/ai/budget";
import { aiInsights } from "@/server/ai/insights";
import { listChurchesWithMetrics } from "@/server/platform";
import { getPlatformSettings } from "@/server/settings";
import { PlatformBudgetForm } from "../forms";

export const metadata: Metadata = { title: "IA" };

export default async function PlatformAiPage() {
  const [insights, churches, platform] = await Promise.all([
    aiInsights({ days: 30, timeZone: PLATFORM_TIMEZONE }),
    listChurchesWithMetrics(30),
    getPlatformSettings(),
  ]);
  const today = insights.daily.at(-1);
  const ranked = churches.filter((c) => c.metrics.aiRuns > 0).sort((a, b) => b.metrics.aiCost - a.metrics.aiCost);

  return (
    <div className="space-y-4">
      <PageHeader
        title="IA em todas as igrejas"
        description="Custo, cache, latência e falhas do assistente nos últimos 30 dias. Só medidas: as perguntas ficam dentro de cada igreja."
      />
      <AiKpis insights={insights} />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <AiTrendCard daily={insights.daily} totals={insights.totals} />
        <Section title="Teto global" description="Somando todas as igrejas; o dia vira à meia-noite de Brasília">
          <div className="px-5 pb-4">
            <BudgetMeter
              label="Gasto de hoje"
              line={{ spent: today?.cost ?? 0, cap: platform.aiDailyBudgetUsd }}
              progress={dayProgress(PLATFORM_TIMEZONE)}
            />
          </div>
          <PlatformBudgetForm value={platform.aiDailyBudgetUsd} />
        </Section>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TokenMix tokens={insights.tokens} cacheHit={insights.totals.cacheHit} />
        <Satisfaction totals={insights.totals} />
        <LatencyHistogram bins={insights.latencyBins} p50={insights.totals.p50} p95={insights.totals.p95} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <UsageHeatmap grid={insights.heatmap} />
        <Section title="Custo por igreja" description="Quem mais usa o assistente no período">
          <BarList
            empty="Nenhum uso no período."
            rows={ranked.map((c) => ({
              key: c.id,
              label: c.name,
              href: `/plataforma/igrejas/${c.id}`,
              value: c.metrics.aiCost,
              display: usd(c.metrics.aiCost),
              note: (
                <>
                  {c.metrics.aiRuns} perguntas
                  {c.metrics.aiBad > 0 && ` · ${c.metrics.aiBad} 👎`}
                  {c.metrics.aiErrors > 0 && <span className="text-destructive"> · {c.metrics.aiErrors} erros</span>}
                </>
              ),
            }))}
          />
        </Section>
      </div>
      <StepTables tools={insights.tools} models={insights.models} />
      <ErrorKinds errors={insights.errorKinds} />
    </div>
  );
}
