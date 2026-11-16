import { Section, StatCard } from "@/components/app/page-header";
import type { BudgetLine } from "@/server/ai/budget";
import type { aiInsights } from "@/server/ai/insights";
import { TOOL_BY_NAME } from "@/server/ai/tools";
import { cn } from "@/lib/utils";

type Insights = Awaited<ReturnType<typeof aiInsights>>;

/** Valores de IA são frações de centavo: mostra dígitos suficientes para não virar "0.000". */
export const usd = (v: number) =>
  v === 0 ? "US$ 0" : `US$ ${v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toPrecision(2)}`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

export function AiStatCards({ totals }: { totals: Insights["totals"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Perguntas" value={totals.runs} hint={`${totals.errors} com erro (${pct(totals.errors, totals.runs)})`} />
      <StatCard label="Custo estimado" value={usd(totals.cost)} hint={totals.runs ? `${usd(totals.cost / totals.runs)} por pergunta` : "—"} tone="gold" />
      <StatCard label="Tempo de resposta" value={secs(totals.p50)} hint={`p95 ${secs(totals.p95)}`} tone="sky" />
      <StatCard
        label="Satisfação"
        value={pct(totals.good, totals.rated)}
        hint={`${totals.rated} avaliações · cache ${Math.round(totals.cacheHit * 100)}%`}
        tone="sage"
      />
    </div>
  );
}

/** Barras por dia (perguntas, com o custo no título). Sem biblioteca: renderiza no servidor. */
export function DailyBars({ daily }: { daily: Insights["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.runs));
  return (
    <Section title="Uso por dia" description="Perguntas por dia; passe o mouse para ver custo e erros">
      <div className="flex h-32 items-end gap-0.5 px-5 pb-2">
        {daily.map((d) => (
          <div
            key={d.day}
            title={`${d.day.split("-").reverse().join("/")}: ${d.runs} perguntas · ${usd(d.cost)}${d.errors ? ` · ${d.errors} com erro` : ""}`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <div
              className={cn("w-full rounded-t-sm bg-primary/70", d.errors && "bg-destructive/70")}
              style={{ height: `${Math.max(d.runs ? 4 : 1, (d.runs / max) * 100)}%`, opacity: d.runs ? 1 : 0.25 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between px-5 pb-4 text-xs text-muted-foreground">
        <span>{daily[0]?.day.split("-").reverse().slice(0, 2).join("/")}</span>
        <span>hoje</span>
      </div>
    </Section>
  );
}

function LatencyTable({
  rows,
  label,
  extra,
}: {
  rows: { name: string; calls: number; failed: number; p50: number; p95: number; extra?: string; write?: boolean }[];
  label: (name: string) => string;
  extra?: string;
}) {
  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 text-right font-medium">Chamadas</th>
            <th className="px-4 py-2 text-right font-medium">Falhas</th>
            <th className="px-4 py-2 text-right font-medium">p50</th>
            <th className="px-4 py-2 text-right font-medium">p95</th>
            {extra && <th className="px-4 py-2 text-right font-medium">{extra}</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="max-w-56 truncate px-4 py-2">
                {label(r.name)}
                {r.write && <span className="ml-1.5 text-xs text-primary">escrita</span>}
              </td>
              <td className="px-4 py-2 text-right tabular">{r.calls}</td>
              <td className={cn("px-4 py-2 text-right tabular", r.failed > 0 && "text-destructive")}>
                {r.failed ? `${r.failed} (${pct(r.failed, r.calls)})` : "—"}
              </td>
              <td className="px-4 py-2 text-right tabular text-muted-foreground">{secs(r.p50)}</td>
              <td className="px-4 py-2 text-right tabular text-muted-foreground">{secs(r.p95)}</td>
              {extra && <td className="px-4 py-2 text-right tabular">{r.extra}</td>}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={extra ? 6 : 5} className="px-4 py-6 text-center text-muted-foreground">
                Nenhuma chamada no período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StepTables({ tools, models }: { tools: Insights["tools"]; models: Insights["models"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Ferramentas" description="Cada ação que a IA executou: volume, falhas e tempo (registrado por passo desde 16/11/2026)">
        <LatencyTable rows={tools} label={(n) => TOOL_BY_NAME.get(n)?.label ?? n} />
      </Section>
      <Section title="Chamadas ao modelo" description="Tempo de cada chamada ao provedor e custo">
        <LatencyTable rows={models.map((m) => ({ ...m, extra: usd(m.cost) }))} label={(n) => n} extra="Custo" />
      </Section>
    </div>
  );
}

export function ErrorKinds({ errors }: { errors: Insights["errorKinds"] }) {
  if (!errors.length) return null;
  return (
    <Section title="Erros mais comuns" description="Agrupados pela mensagem, sem o conteúdo das perguntas">
      <ul className="divide-y border-t">
        {errors.map((e) => (
          <li key={e.label} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
            <span className="min-w-0 break-words">{e.label}</span>
            <span className="shrink-0 tabular text-destructive">{e.count}×</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Gasto de hoje contra o teto (sem teto: só o gasto). */
export function BudgetMeter({ label, line }: { label: string; line: BudgetLine }) {
  const ratio = line.cap ? Math.min(1, line.spent / line.cap) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular text-muted-foreground">
          {usd(line.spent)} {line.cap !== null ? `de ${usd(line.cap)}` : "· sem teto"}
        </span>
      </div>
      {line.cap !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full bg-primary", ratio >= 1 ? "bg-destructive" : ratio >= 0.8 && "bg-amber-500")}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
