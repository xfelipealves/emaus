"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatDate } from "@/lib/dates";

const config = {
  members: { label: "Membros", color: "var(--c-ember)" },
  visitors: { label: "Visitantes", color: "var(--c-gold)" },
} satisfies ChartConfig;

export function AttendanceChart({
  data,
}: {
  data: { week: string; members: number; visitors: number }[];
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <defs>
          {(["members", "visitors"] as const).map((k) => (
            <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${k})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${k})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => formatDate(v, undefined, { day: "2-digit", month: "short" })}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(v) => `Semana de ${formatDate(String(v), undefined, { day: "2-digit", month: "long" })}`}
            />
          }
        />
        <Area dataKey="visitors" type="monotone" stackId="a" fill="url(#fill-visitors)" stroke="var(--color-visitors)" strokeWidth={2} />
        <Area dataKey="members" type="monotone" stackId="a" fill="url(#fill-members)" stroke="var(--color-members)" strokeWidth={2} />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}

const simpleConfig = { present: { label: "Presentes", color: "var(--tone, var(--c-ember))" } } satisfies ChartConfig;

export function TrendChart({ data }: { data: { week: string; present: number }[] }) {
  return (
    <ChartContainer config={simpleConfig} className="aspect-auto h-44 w-full">
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fill-present" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-present)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-present)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => formatDate(v, undefined, { day: "2-digit", month: "short" })}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => `Semana de ${formatDate(String(v), undefined, { day: "2-digit", month: "long" })}`} />} />
        <Area dataKey="present" type="monotone" fill="url(#fill-present)" stroke="var(--color-present)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}
