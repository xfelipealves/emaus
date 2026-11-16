import { ArrowDownRight, ArrowUpRight, CircleAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/app/page-header";
import type { BudgetLine } from "@/server/ai/budget";
import type { aiInsights } from "@/server/ai/insights";
import { TOOL_BY_NAME } from "@/server/ai/tools";
import { startOfDayUtc, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Insights = Awaited<ReturnType<typeof aiInsights>>;

/** Valores de IA são frações de centavo: mostra dígitos suficientes para não virar "0.000". */
export const usd = (v: number) =>
  v === 0 ? "US$ 0" : `US$ ${v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toPrecision(2)}`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");
const compact = (n: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/* ───────────── Indicadores ───────────── */

/** Linha de tendência sem eixos; `null` vira lacuna (dia sem dado), não zero. */
function Sparkline({ values }: { values: (number | null)[] }) {
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  if (!max) return <div className="h-10" />;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * 100;
  const y = (v: number) => 30 - (v / max) * 28;
  let line = "";
  values.forEach((v, i) => {
    if (v === null) return;
    line += `${line && values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
  });
  const solid = values.every((v) => v !== null);
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-10 w-full overflow-visible" aria-hidden>
      {solid && <path d={`${line}L100,32L0,32Z`} fill="var(--ai-1)" opacity={0.1} />}
      <path d={line} fill="none" stroke="var(--ai-1)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Variação contra os N dias anteriores; a cor diz se subir é bom ou ruim. */
function Delta({ now, before, upIsGood, points }: { now: number; before: number; upIsGood: boolean; points?: boolean }) {
  if (!points && !before) return <span className="text-muted-foreground">sem período anterior</span>;
  const change = points ? now - before : (now - before) / before;
  if (Math.abs(change) < 0.005) return <span className="text-muted-foreground">estável vs período anterior</span>;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-flex items-center font-medium", up === upIsGood ? "text-success" : "text-destructive")}>
        <Icon className="size-3.5" />
        {points ? `${Math.abs(Math.round(change * 100))} p.p.` : `${Math.abs(Math.round(change * 100))}%`}
      </span>
      <span className="text-muted-foreground">vs período anterior</span>
    </span>
  );
}

function KpiTile({ label, value, delta, trend, hint }: { label: string; value: string; delta: React.ReactNode; trend?: (number | null)[]; hint: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs">{delta}</div>
      <div className="mt-auto pt-3">{trend ? <Sparkline values={trend} /> : null}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

export function AiKpis({ insights }: { insights: Insights }) {
  const { totals: t, previous: p, daily } = insights;
  const satisfaction = t.rated ? t.good / t.rated : 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label="Perguntas"
        value={t.runs.toLocaleString("pt-BR")}
        delta={<Delta now={t.runs} before={p.runs} upIsGood />}
        trend={daily.map((d) => d.runs)}
        hint={`${t.errors} com erro (${pct(t.errors, t.runs)})`}
      />
      <KpiTile
        label="Custo estimado"
        value={usd(t.cost)}
        delta={<Delta now={t.cost} before={p.cost} upIsGood={false} />}
        trend={daily.map((d) => d.cost)}
        hint={t.runs ? `${usd(t.cost / t.runs)} por pergunta` : "—"}
      />
      <KpiTile
        label="Tempo de resposta"
        value={secs(t.p50)}
        delta={<Delta now={t.p50} before={p.p50} upIsGood={false} />}
        trend={daily.map((d) => (d.ok ? d.p50 : null))}
        hint={`mediana · p95 ${secs(t.p95)}`}
      />
      <KpiTile
        label="Satisfação"
        value={pct(t.good, t.rated)}
        delta={t.rated && p.rated ? <Delta now={satisfaction} before={p.good / p.rated} upIsGood points /> : <span className="text-muted-foreground">{t.rated ? "sem período anterior" : "sem avaliações ainda"}</span>}
        trend={daily.map((_, i) => {
          const week = daily.slice(Math.max(0, i - 6), i + 1);
          const rated = week.reduce((s, d) => s + d.rated, 0);
          return rated ? week.reduce((s, d) => s + d.good, 0) / rated : null;
        })}
        hint={`${t.rated} avaliações de ${t.runs} respostas · média de 7 dias`}
      />
    </div>
  );
}

/* ───────────── Teto do dia ───────────── */

/** Fração do dia já decorrida no fuso: base da projeção "no ritmo atual". */
export function dayProgress(timeZone: string) {
  const start = startOfDayUtc(todayIso(timeZone), timeZone).getTime();
  return Math.min(1, Math.max(0, (Date.now() - start) / 86_400_000));
}

/** Gasto de hoje contra o teto, com a projeção do dia no ritmo atual (sem teto: só o gasto). */
export function BudgetMeter({ label, line, progress }: { label: string; line: BudgetLine; progress?: number }) {
  const scale = line.cap ?? 0;
  const ratio = scale ? Math.min(1, line.spent / scale) : 0;
  // Projeção só depois de um pedaço do dia: de madrugada ela extrapola demais.
  const projected = progress && progress > 0.2 && line.spent > 0 ? line.spent / progress : null;
  const projRatio = projected && scale ? Math.min(1, projected / scale) : 0;
  const tone = ratio >= 1 ? "bg-destructive" : ratio >= 0.8 ? "bg-warning" : "bg-[var(--ai-1)]";
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-right">
          <span className="text-lg font-semibold">{usd(line.spent)}</span>
          <span className="text-sm text-muted-foreground"> {line.cap !== null ? `de ${usd(line.cap)}` : "· sem teto"}</span>
        </span>
      </div>
      {line.cap !== null && (
        <div className="relative h-2.5 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--ai-1)_14%,var(--muted))]">
          {projRatio > ratio && (
            <div className="absolute inset-y-0 left-0 rounded-full bg-[color-mix(in_oklch,var(--ai-1)_30%,transparent)]" style={{ width: `${projRatio * 100}%` }} />
          )}
          <div className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${Math.max(ratio ? 2 : 0, ratio * 100)}%` }} />
        </div>
      )}
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p>{line.cap !== null ? `${pct(line.spent, line.cap)} do teto` : "Sem teto: a IA não pausa por gasto."}</p>
        {projected !== null && (
          <p className={cn(line.cap !== null && projected > line.cap && "font-medium text-destructive")}>
            No ritmo atual, o dia fecha em ~{usd(projected)}
            {line.cap !== null && projected > line.cap && " — acima do teto"}
          </p>
        )}
      </div>
    </div>
  );
}

/* ───────────── Tokens, cache e satisfação ───────────── */

const TOKEN_PARTS = [
  { key: "fresh", label: "Entrada nova", color: "var(--ai-1)" },
  { key: "output", label: "Saída", color: "var(--ai-2)" },
  { key: "cacheWrite", label: "Gravado no cache", color: "var(--ai-3)" },
  { key: "cacheRead", label: "Lido do cache", color: "var(--ai-4)" },
] as const;

/** Barra empilhada com 2px de respiro entre os segmentos (o fundo faz a separação). */
function StackedBar({ parts }: { parts: { key: string; label: string; color: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="h-3 rounded-full bg-muted" />;
  return (
    <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <div key={p.key} title={`${p.label}: ${pct(p.value, total)}`} style={{ flexGrow: p.value, flexBasis: 0, minWidth: 3, background: p.color }} />
        ))}
    </div>
  );
}

export function TokenMix({ tokens, cacheHit }: { tokens: Insights["tokens"]; cacheHit: number }) {
  const parts = TOKEN_PARTS.map((p) => ({ ...p, value: tokens[p.key] }));
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <Section title="Tokens e cache" description="Quanto do contexto veio do cache: mais cache, resposta mais barata e rápida">
      <div className="space-y-4 px-5 pb-5">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight">{Math.round(cacheHit * 100)}%</span>
          <span className="text-sm text-muted-foreground">da entrada lida do cache</span>
        </div>
        <StackedBar parts={parts} />
        <ul className="space-y-1.5 text-xs">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.label}</span>
              <span className="w-10 text-right text-muted-foreground tabular">{pct(p.value, total)}</span>
              <span className="w-14 text-right tabular">{compact(p.value)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{compact(total)} tokens no período</p>
      </div>
    </Section>
  );
}

export function Satisfaction({ totals }: { totals: Insights["totals"] }) {
  const unrated = Math.max(0, totals.runs - totals.errors - totals.rated);
  const parts = [
    { key: "good", label: "Útil", color: "var(--success)", value: totals.good, icon: ThumbsUp },
    { key: "bad", label: "Não ajudou", color: "var(--destructive)", value: totals.bad, icon: ThumbsDown },
    { key: "none", label: "Sem avaliação", color: "var(--border)", value: unrated, icon: null },
    { key: "err", label: "Com erro", color: "color-mix(in oklch, var(--destructive) 35%, var(--muted))", value: totals.errors, icon: CircleAlert },
  ];
  return (
    <Section title="O que acharam" description="Avaliações 👍/👎 deixadas no chat">
      <div className="space-y-4 px-5 pb-5">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight">{pct(totals.good, totals.rated)}</span>
          <span className="text-sm text-muted-foreground">das avaliações foram 👍</span>
        </div>
        <StackedBar parts={parts} />
        <ul className="space-y-1.5 text-xs">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
              <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-muted-foreground">
                {p.icon && <p.icon className="size-3" />} {p.label}
              </span>
              <span className="w-14 text-right tabular">{p.value}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Avaliado: {pct(totals.rated, totals.runs)} das respostas</p>
      </div>
    </Section>
  );
}

/* ───────────── Rankings ───────────── */

export type BarRow = { key: string; label: React.ReactNode; value: number; display: string; href?: string; note?: React.ReactNode };

/** Ranking em barras horizontais: rótulo e valor em texto, a barra só dá a proporção. */
export function BarList({ rows, empty = "Nada no período.", tone = "var(--ai-1)" }: { rows: BarRow[]; empty?: string; tone?: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="border-t px-5 py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3 border-t px-5 py-4">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.href ? (
                <Link href={r.href} className="hover:underline">
                  {r.label}
                </Link>
              ) : (
                r.label
              )}
            </span>
            <span className="shrink-0 text-sm font-medium tabular">{r.display}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${max ? Math.max(1.5, (r.value / max) * 100) : 0}%`, background: tone }} />
          </div>
          {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
        </li>
      ))}
    </ul>
  );
}

/* ───────────── Ferramentas, modelos e erros ───────────── */

function LatencyTable({
  rows,
  label,
  extra,
}: {
  rows: { name: string; calls: number; failed: number; p50: number; p95: number; extra?: string; write?: boolean }[];
  label: (name: string) => string;
  extra?: string;
}) {
  const maxCalls = Math.max(1, ...rows.map((r) => r.calls));
  const maxP95 = Math.max(1, ...rows.map((r) => r.p95));
  return (
    <div className="overflow-x-auto border-t">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="w-[30%] px-4 py-2 font-medium">Chamadas</th>
            <th className="px-4 py-2 text-right font-medium">Falhas</th>
            <th className="w-[22%] px-4 py-2 font-medium whitespace-nowrap">Tempo p50 → p95</th>
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
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[var(--ai-1)]" style={{ width: `${(r.calls / maxCalls) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs tabular">{r.calls}</span>
                </div>
              </td>
              <td className={cn("px-4 py-2 text-right whitespace-nowrap tabular", r.failed > 0 ? "text-destructive" : "text-muted-foreground")}>
                {r.failed ? `${r.failed} (${pct(r.failed, r.calls)})` : "—"}
              </td>
              <td className="px-4 py-2" title={`p50 ${secs(r.p50)} · p95 ${secs(r.p95)}`}>
                {/* Faixa entre a mediana e as mais lentas, na mesma escala para todas as linhas. */}
                <div className="relative h-1.5 rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 rounded-full bg-[color-mix(in_oklch,var(--ai-2)_45%,transparent)]"
                    style={{ left: `${(r.p50 / maxP95) * 100}%`, width: `${Math.max(1, ((r.p95 - r.p50) / maxP95) * 100)}%` }}
                  />
                  <div className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ai-2)] ring-2 ring-card" style={{ left: `${(r.p50 / maxP95) * 100}%` }} />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground tabular">
                  {secs(r.p50)} → {secs(r.p95)}
                </div>
              </td>
              {extra && <td className="px-4 py-2 text-right whitespace-nowrap tabular">{r.extra}</td>}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={extra ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">
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
    <div className="grid gap-4 xl:grid-cols-2">
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
      <BarList rows={errors.map((e) => ({ key: e.label, label: e.label, value: e.count, display: `${e.count}×` }))} tone="var(--destructive)" />
    </Section>
  );
}
