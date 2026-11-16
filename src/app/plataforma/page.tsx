import type { Metadata } from "next";
import Link from "next/link";
import { usd } from "@/components/app/ai-panels";
import { PageHeader, Section, StatCard } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/tone";
import { formatRelative } from "@/lib/dates";
import { isDemoMode } from "@/lib/demo";
import { cn } from "@/lib/utils";
import { listChurchesWithMetrics } from "@/server/platform";
import { NewChurchButton } from "./forms";

export const metadata: Metadata = { title: "Igrejas" };

export default async function PlatformHome() {
  const churches = await listChurchesWithMetrics(30);
  const active = churches.filter((c) => c.active);
  const sum = (pick: (m: (typeof churches)[number]["metrics"]) => number) => churches.reduce((s, c) => s + pick(c.metrics), 0);

  return (
    <>
      <PageHeader
        title="Igrejas"
        description="Uso de cada igreja nos últimos 30 dias. Só contagens: dados pastorais e perguntas à IA ficam dentro de cada igreja."
        actions={<NewChurchButton />}
      />
      {isDemoMode() && (
        <p role="status" className="mb-4 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Este deploy hospeda a demonstração pública. As igrejas de demonstração ficam travadas; igrejas novas funcionam normalmente,
          mas ficam no mesmo banco da demonstração.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Igrejas ativas" value={active.length} hint={`${churches.length - active.length} suspensas`} />
        <StatCard label="Contas ativas" value={sum((m) => m.users)} hint={`${sum((m) => m.people)} pessoas acompanhadas`} tone="sky" />
        <StatCard label="Presenças (30 dias)" value={sum((m) => m.attendance)} hint={`${sum((m) => m.events)} encontros realizados`} tone="sage" />
        <StatCard label="IA (30 dias)" value={usd(sum((m) => m.aiCost))} hint={`${sum((m) => m.aiRuns)} perguntas · ${sum((m) => m.aiErrors)} erros`} tone="gold" />
      </div>

      <Section className="mt-4" title="Uso por igreja" description="Clique numa igreja para ver detalhes, contas e limites de IA">
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Igreja</th>
                <th className="px-4 py-2 text-right font-medium">Contas</th>
                <th className="px-4 py-2 text-right font-medium">Pessoas</th>
                <th className="px-4 py-2 text-right font-medium">Encontros</th>
                <th className="px-4 py-2 text-right font-medium" title="Presenças registradas (quiosque / QR)">Presenças</th>
                <th className="px-4 py-2 text-right font-medium" title="Acompanhamentos abertos / concluídos em 30 dias">Cuidado</th>
                <th className="px-4 py-2 text-right font-medium">Anotações</th>
                <th className="px-4 py-2 text-right font-medium">IA</th>
                <th className="px-4 py-2 font-medium">Último acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {churches.map((c) => {
                const m = c.metrics;
                return (
                  <tr key={c.id} className={cn(!c.active && "opacity-60")}>
                    <td className="px-4 py-2.5">
                      <Link href={`/plataforma/igrejas/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      <div className="mt-0.5 flex gap-1.5 text-xs text-muted-foreground">
                        {c.slug}
                        {!c.active && <ToneBadge tone="rose">suspensa</ToneBadge>}
                        {c.demo && <ToneBadge tone="slate">demo</ToneBadge>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{m.users}</td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {m.people}
                      <div className="text-xs text-muted-foreground">{m.visitors} visitantes</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{m.events}</td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {m.attendance}
                      <div className="text-xs text-muted-foreground">
                        {m.kiosk} / {m.qr}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {m.openFollowUps}
                      <div className="text-xs text-muted-foreground">{m.doneFollowUps} feitos</div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{m.notes}</td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {m.aiRuns}
                      <div className={cn("text-xs text-muted-foreground", m.aiErrors > 0 && "text-destructive")}>
                        {usd(m.aiCost)}
                        {m.aiErrors > 0 && ` · ${m.aiErrors} erros`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{m.lastSeen ? formatRelative(m.lastSeen) : "nunca"}</td>
                  </tr>
                );
              })}
              {churches.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma igreja ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
