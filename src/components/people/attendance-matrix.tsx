"use client";

import { Check, Minus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ToneDot } from "@/components/app/tone";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatDaysAgo, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { MatrixCell, MatrixRow } from "@/server/attendance-matrix";

type Props = {
  weekStarts: string[];
  rows: MatrixRow[];
  stats: {
    expected: number;
    present: number;
    rate: number | null;
    streak: number;
    lastPresent: { title: string; date: string } | null;
  };
  tz: string;
  daysSinceLast: number | null;
};

const STATUS_LABEL = { present: "Presente", absent: "Ausente", missed: "Não veio", unknown: "Chamada não lançada" } as const;

export function AttendanceMatrix({ weekStarts, rows, stats, tz, daysSinceLast }: Props) {
  const rate = stats.rate === null ? null : Math.round(stats.rate * 100);
  const scroller = useRef<HTMLDivElement>(null);
  // Em telas estreitas, abre já mostrando as semanas mais recentes.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Presença"
          value={rate === null ? "—" : `${rate}%`}
          hint={stats.expected ? `${stats.present} de ${stats.expected}` : "sem chamadas"}
          tone={rate === null ? undefined : rate >= 70 ? "text-success" : rate >= 40 ? "text-warning" : "text-destructive"}
        />
        <Stat label="Sequência" value={`${stats.streak}`} hint={stats.streak === 1 ? "semana" : "semanas"} />
        <Stat
          label="Última vez"
          value={daysSinceLast === null ? "—" : formatDaysAgo(daysSinceLast)}
          hint={stats.lastPresent ? stats.lastPresent.title : "nenhuma no período"}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum encontro para esta pessoa nas últimas semanas.
        </p>
      ) : (
        <div ref={scroller} className="overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 w-32 min-w-32 bg-muted px-3 py-2 text-left font-medium sm:w-auto sm:min-w-44">Encontro</th>
                {weekStarts.map((w, i) => {
                  const newMonth = i === 0 || w.slice(5, 7) !== weekStarts[i - 1].slice(5, 7);
                  return (
                    <th key={w} className="min-w-10 px-1 py-2 text-center font-normal">
                      <div className={cn("text-[10px] uppercase", newMonth ? "font-semibold text-foreground" : "opacity-0")}>
                        {formatDate(w, tz, { month: "short" }).replace(".", "")}
                      </div>
                      <div className="tabular">{Number(w.slice(8))}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="sticky left-0 z-10 max-w-32 bg-card px-3 py-2 text-left font-medium sm:max-w-none">
                    <span className="flex items-center gap-2">
                      <ToneDot tone={row.color} />
                      <span className="truncate">{row.label}</span>
                    </span>
                  </th>
                  {row.weeks.map((cells, i) => (
                    <td key={i} className="px-1 py-2 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {cells.length === 0 ? (
                          <span className="block size-1 rounded-full bg-border" aria-hidden />
                        ) : (
                          cells.map((c) => <Cell key={c.eventId} cell={c} tz={tz} />)
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <Legend className="bg-success text-background"><Check className="size-3" strokeWidth={3} /></Legend> Presente
        <Legend className="border-2 border-destructive/60 text-destructive"><X className="size-3" strokeWidth={3} /></Legend> Ausente
        <Legend className="bg-muted text-muted-foreground"><X className="size-3" /></Legend> Não veio
        <Legend className="border border-dashed border-muted-foreground/40 text-muted-foreground"><Minus className="size-3" /></Legend> Chamada não lançada
        <span className="inline-flex items-center gap-1.5"><span className="size-1 rounded-full bg-border" /> Sem encontro na semana</span>
      </div>
    </div>
  );
}

function Cell({ cell, tz }: { cell: MatrixCell; tz: string }) {
  const label = `${cell.title} · ${formatDate(cell.startsAt, tz, { weekday: "short", day: "2-digit", month: "short" })} ${formatTime(cell.startsAt, tz)} · ${STATUS_LABEL[cell.status]}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`/encontros/${cell.eventId}`}
            aria-label={label}
            className={cn(
              "flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
              cell.status === "present" && "bg-success text-background",
              cell.status === "absent" && "border-2 border-destructive/60 text-destructive",
              cell.status === "missed" && "bg-muted text-muted-foreground",
              cell.status === "unknown" && "border border-dashed border-muted-foreground/40 text-muted-foreground/60",
            )}
          />
        }
      >
        {cell.status === "present" ? (
          <Check className="size-3.5" strokeWidth={3} />
        ) : cell.status === "absent" ? (
          <X className="size-3.5" strokeWidth={3} />
        ) : cell.status === "missed" ? (
          <X className="size-3" />
        ) : (
          <Minus className="size-3" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-3 sm:px-4">
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate font-display text-2xl leading-none tabular sm:text-3xl", tone)}>{value}</div>
      <div className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex size-4 items-center justify-center rounded-full", className)}>{children}</span>;
}
