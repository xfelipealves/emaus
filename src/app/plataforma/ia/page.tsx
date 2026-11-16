import type { Metadata } from "next";
import Link from "next/link";
import { AiStatCards, BudgetMeter, DailyBars, ErrorKinds, StepTables, usd } from "@/components/app/ai-panels";
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
      <AiStatCards totals={insights.totals} />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <DailyBars daily={insights.daily} />
        <Section title="Teto global" description="Somando todas as igrejas; o dia vira à meia-noite de Brasília">
          <div className="px-5 pb-4">
            <BudgetMeter label="Gasto de hoje" line={{ spent: today?.cost ?? 0, cap: platform.aiDailyBudgetUsd }} />
          </div>
          <PlatformBudgetForm value={platform.aiDailyBudgetUsd} />
        </Section>
      </div>
      <Section title="Custo por igreja">
        <ul className="divide-y border-t">
          {ranked.map((c) => (
            <li key={c.id} className="flex justify-between gap-3 px-5 py-2.5 text-sm">
              <Link href={`/plataforma/igrejas/${c.id}`} className="text-primary hover:underline">
                {c.name}
              </Link>
              <span className="tabular text-muted-foreground">
                {c.metrics.aiRuns} perguntas · {usd(c.metrics.aiCost)}
                {c.metrics.aiBad > 0 && ` · ${c.metrics.aiBad} 👎`}
                {c.metrics.aiErrors > 0 && <span className="text-destructive"> · {c.metrics.aiErrors} erros</span>}
              </span>
            </li>
          ))}
          {ranked.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Nenhum uso no período.</li>}
        </ul>
      </Section>
      <StepTables tools={insights.tools} models={insights.models} />
      <ErrorKinds errors={insights.errorKinds} />
    </div>
  );
}
