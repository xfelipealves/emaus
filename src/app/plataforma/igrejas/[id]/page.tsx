import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiStatCards, BudgetMeter, DailyBars, ErrorKinds, StepTables } from "@/components/app/ai-panels";
import { PageHeader, Section, StatCard } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/tone";
import { formatDate, formatRelative } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/labels";
import { aiBudgetStatus } from "@/server/ai/budget";
import { aiInsights } from "@/server/ai/insights";
import { getChurchForPlatform, listChurchesWithMetrics } from "@/server/platform";
import { ChurchActiveButton, ChurchBudgetForm } from "../../forms";

export const metadata: Metadata = { title: "Igreja" };

export default async function PlatformChurchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getChurchForPlatform(id);
  if (!data) notFound();
  const { church, users } = data;
  const [all, insights, budget] = await Promise.all([
    listChurchesWithMetrics(30),
    aiInsights({ churchId: id, days: 30, timeZone: church.timezone }),
    aiBudgetStatus(id),
  ]);
  const m = all.find((c) => c.id === id)!.metrics;

  return (
    <div className="space-y-4">
      <Link href="/plataforma" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Igrejas
      </Link>
      <PageHeader
        className="pb-2"
        title={church.name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {church.slug} · {church.timezone} · desde {formatDate(church.createdAt, church.timezone)}
            {!church.active && <ToneBadge tone="rose">suspensa</ToneBadge>}
            {church.demo && <ToneBadge tone="slate">demo</ToneBadge>}
          </span>
        }
        actions={<ChurchActiveButton churchId={church.id} active={church.active} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pessoas ativas" value={m.people} hint={`${m.visitors} visitantes`} />
        <StatCard label="Encontros (30 dias)" value={m.events} hint={`${m.attendance} presenças · ${m.kiosk} quiosque · ${m.qr} QR`} tone="sky" />
        <StatCard label="Cuidado pastoral" value={m.openFollowUps} hint={`abertos · ${m.doneFollowUps} feitos em 30 dias · ${m.notes} anotações`} tone="sage" />
        <StatCard label="Último acesso" value={m.lastSeen ? formatRelative(m.lastSeen) : "nunca"} hint={`${m.users} contas ativas`} tone="gold" />
      </div>

      <Section title="Contas" description="Quem acessa esta igreja (o operador não vê dados das pessoas)">
        <ul className="divide-y border-t">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                {u.name} <span className="text-xs text-muted-foreground">@{u.username}</span>
                {!u.active && <ToneBadge tone="rose">desativada</ToneBadge>}
                {u.mustChangePassword && <ToneBadge tone="gold">senha provisória</ToneBadge>}
              </span>
              <span className="text-xs text-muted-foreground">
                {ROLE_LABEL[u.role]} · {u.lastSeen ? `visto ${formatRelative(u.lastSeen)}` : "nunca entrou"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Limites diários de IA" description="Ao atingir o teto, o assistente da igreja pausa até o dia seguinte">
        <div className="space-y-3 px-5 pb-4">
          <BudgetMeter label="Gasto de hoje" line={budget.church} />
        </div>
        <ChurchBudgetForm churchId={church.id} church={church.aiDailyBudgetUsd} user={church.aiUserDailyBudgetUsd} />
      </Section>

      <h2 className="pt-2 font-display text-2xl">Assistente de IA · 30 dias</h2>
      <AiStatCards totals={insights.totals} />
      <DailyBars daily={insights.daily} />
      <StepTables tools={insights.tools} models={insights.models} />
      <ErrorKinds errors={insights.errorKinds} />
    </div>
  );
}
