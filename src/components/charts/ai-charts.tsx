"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";
import { Section } from "@/components/app/page-header";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Day = { day: string; runs: number; ok: number; errors: number; cost: number; p50: number; p95: number };

/** Mesma regra do servidor (ai-panels): frações de centavo sem virar "0.000". */
const usd = (v: number) =>
  v === 0 ? "US$ 0" : `US$ ${v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toPrecision(2)}`;
/** Eixo de custo: curto, para não cortar nem quebrar linha. */
const usdTick = (v: number) => (v === 0 ? "0" : `$${v >= 0.1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : v.toPrecision(1)}`);
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const shortDay = (v: string) => formatDate(v, undefined, { day: "2-digit", month: "short" });
const longDay = (v: unknown) => formatDate(String(v), undefined, { weekday: "short", day: "2-digit", month: "long" });

const runsConfig = {
  ok: { label: "Respondidas", color: "var(--ai-1)" },
  errors: { label: "Com erro", color: "var(--destructive)" },
} satisfies ChartConfig;
const costConfig = { cost: { label: "Custo", color: "var(--ai-1)" } } satisfies ChartConfig;
const latencyConfig = {
  p50: { label: "Mediana (p50)", color: "var(--ai-1)" },
  p95: { label: "Mais lentas (p95)", color: "var(--ai-2)" },
} satisfies ChartConfig;

const axis = { tickLine: false, axisLine: false, tickMargin: 8 } as const;

type Metric = "runs" | "cost" | "latency";

/** Evolução diária, com a métrica escolhida nas abas: volume, custo ou tempo de resposta. */
export function AiTrendCard({ daily, totals }: { daily: Day[]; totals: { runs: number; cost: number; p50: number; errors: number } }) {
  const [metric, setMetric] = useState<Metric>("runs");
  const headline = {
    runs: { value: totals.runs.toLocaleString("pt-BR"), hint: `perguntas · ${totals.errors} com erro` },
    cost: { value: usd(totals.cost), hint: "no período" },
    latency: { value: secs(totals.p50), hint: "mediana no período" },
  }[metric];
  // Dias sem pergunta não têm tempo de resposta: viram lacuna, não zero.
  const latency = daily.map((d) => ({ day: d.day, p50: d.ok ? d.p50 / 1000 : null, p95: d.ok ? d.p95 / 1000 : null }));

  return (
    <Section
      title="Evolução diária"
      description="Passe o mouse sobre um dia para ver os detalhes"
      action={
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList>
            <TabsTrigger value="runs">Perguntas</TabsTrigger>
            <TabsTrigger value="cost">Custo</TabsTrigger>
            <TabsTrigger value="latency">Tempo</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="flex items-baseline gap-2 px-5">
        <span className="text-3xl font-semibold tracking-tight">{headline.value}</span>
        <span className="text-sm text-muted-foreground">{headline.hint}</span>
      </div>
      <div className="px-2 pb-3">
        {metric === "runs" && (
          <ChartContainer config={runsConfig} className="aspect-auto h-64 w-full">
            <BarChart data={daily} margin={{ left: -18, right: 8, top: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" {...axis} minTickGap={24} tickFormatter={shortDay} />
              <YAxis {...axis} allowDecimals={false} width={44} />
              <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltipContent indicator="dot" labelFormatter={longDay} />} />
              <Bar dataKey="ok" stackId="r" fill="var(--color-ok)" maxBarSize={24} radius={[4, 4, 0, 0]} stroke="var(--card)" strokeWidth={1} />
              <Bar dataKey="errors" stackId="r" fill="var(--color-errors)" maxBarSize={24} radius={[4, 4, 0, 0]} stroke="var(--card)" strokeWidth={1} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
        {metric === "cost" && (
          <ChartContainer config={costConfig} className="aspect-auto h-64 w-full">
            <AreaChart data={daily} margin={{ left: -4, right: 8, top: 12 }}>
              <defs>
                <linearGradient id="ai-fill-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" {...axis} minTickGap={24} tickFormatter={shortDay} />
              <YAxis {...axis} width={58} tickCount={4} tickFormatter={usdTick} />
              <ChartTooltip
                cursor={{ stroke: "var(--border)" }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={longDay}
                    formatter={(v) => (
                      <span className="flex w-full justify-between gap-3">
                        <span className="text-muted-foreground">Custo</span>
                        <span className="tabular">{usd(Number(v))}</span>
                      </span>
                    )}
                  />
                }
              />
              <Area dataKey="cost" type="monotone" fill="url(#ai-fill-cost)" stroke="var(--color-cost)" strokeWidth={2} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
            </AreaChart>
          </ChartContainer>
        )}
        {metric === "latency" && (
          <ChartContainer config={latencyConfig} className="aspect-auto h-64 w-full">
            <LineChart data={latency} margin={{ left: -4, right: 8, top: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" {...axis} minTickGap={24} tickFormatter={shortDay} />
              <YAxis {...axis} width={44} tickFormatter={(v: number) => `${v}s`} />
              <ChartTooltip
                cursor={{ stroke: "var(--border)" }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={longDay}
                    formatter={(v, name) => (
                      <span className="flex w-full justify-between gap-3">
                        <span className="text-muted-foreground">{latencyConfig[name as "p50" | "p95"]?.label}</span>
                        <span className="tabular">{Number(v).toFixed(1)}s</span>
                      </span>
                    )}
                  />
                }
              />
              {(["p95", "p50"] as const).map((k) => (
                <Line
                  key={k}
                  dataKey={k}
                  type="monotone"
                  stroke={`var(--color-${k})`}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </Section>
  );
}

const histogramConfig = { runs: { label: "Perguntas", color: "var(--ai-1)" } } satisfies ChartConfig;

/** Distribuição do tempo de resposta: mostra a cauda que a média esconde. */
export function LatencyHistogram({ bins, p50, p95 }: { bins: { from: number; to: number | null; runs: number }[]; p50: number; p95: number }) {
  const data = bins.map((b) => ({ ...b, label: b.to === null ? `${b.from}s+` : `${b.from}–${b.to}s` }));
  return (
    <Section title="Distribuição do tempo" description={`Metade responde em até ${secs(p50)}; as 5% mais lentas passam de ${secs(p95)}`}>
      <div className="px-2 pb-3">
        <ChartContainer config={histogramConfig} className="aspect-auto h-52 w-full">
          <BarChart data={data} margin={{ left: -8, right: 8, top: 20 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...axis} interval={0} fontSize={11} />
            <YAxis {...axis} allowDecimals={false} width={44} />
            <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={<ChartTooltipContent hideIndicator labelFormatter={(v) => `Respostas em ${v}`} />} />
            <Bar dataKey="runs" fill="var(--color-runs)" maxBarSize={36} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="runs" position="top" className="fill-muted-foreground" fontSize={11} formatter={(v: unknown) => (Number(v) ? String(v) : "")} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </Section>
  );
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Quando o assistente é usado: dia da semana × hora, em uma única escala de cor. */
export function UsageHeatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((s, n) => s + n, 0);
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  let peak = { d: 0, h: 0, n: 0 };
  grid.forEach((row, d) => row.forEach((n, h) => n > peak.n && (peak = { d, h, n })));
  // Raiz quadrada: poucos usos ainda aparecem sem que o pico apague o resto.
  const shade = (n: number) => (n ? `color-mix(in oklab, var(--ai-1) ${Math.round(18 + 82 * Math.sqrt(n / max))}%, var(--muted))` : "var(--muted)");
  const readout = hover
    ? `${WEEKDAYS_LONG[hover.d]}, ${hover.h}h–${hover.h + 1}h · ${grid[hover.d][hover.h]} pergunta${grid[hover.d][hover.h] === 1 ? "" : "s"}`
    : peak.n
      ? `Pico: ${WEEKDAYS_LONG[peak.d].toLowerCase()}, ${peak.h}h–${peak.h + 1}h (${peak.n} perguntas)`
      : "Nenhuma pergunta no período";

  return (
    <Section title="Quando usam" description={`${total.toLocaleString("pt-BR")} perguntas por dia da semana e hora`}>
      <div className="overflow-x-auto px-5 pb-4">
        <div className="grid min-w-[560px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))_2.5rem] gap-[3px] text-[10px] text-muted-foreground">
          {grid.map((row, d) => (
            <div key={d} className="contents">
              <span className="self-center">{WEEKDAYS[d]}</span>
              {row.map((n, h) => (
                <span
                  key={h}
                  role="img"
                  tabIndex={0}
                  aria-label={`${WEEKDAYS_LONG[d]} ${h}h: ${n} perguntas`}
                  onMouseEnter={() => setHover({ d, h })}
                  onFocus={() => setHover({ d, h })}
                  onMouseLeave={() => setHover(null)}
                  onBlur={() => setHover(null)}
                  className={cn(
                    "aspect-square rounded-[3px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
                    hover?.d === d && hover.h === h && "ring-2 ring-foreground/40",
                  )}
                  style={{ background: shade(n) }}
                />
              ))}
              <span className="self-center text-right tabular">{row.reduce((s, n) => s + n, 0) || ""}</span>
            </div>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center tabular">
              {h % 3 === 0 ? `${h}h` : ""}
            </span>
          ))}
          <span />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={cn("tabular", hover ? "text-foreground" : "text-muted-foreground")}>{readout}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            menos
            {[0, 0.15, 0.4, 0.7, 1].map((f) => (
              <span key={f} className="size-3 rounded-[3px]" style={{ background: shade(f * max) }} />
            ))}
            mais
          </span>
        </div>
      </div>
    </Section>
  );
}
