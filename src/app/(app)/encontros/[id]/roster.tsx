"use client";

import { Check, Search, Sparkles, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { PersonAvatar, ToneBadge } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { PersonStatus } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { displayName, normalizeSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import { markAllAbsentAction, quickVisitorAction, setAttendanceAction } from "../actions";

type Mark = "present" | "absent" | null;
export type RosterRow = {
  id: string;
  fullName: string;
  preferredName: string | null;
  status: PersonStatus;
  attendance: Mark;
  method: string | null;
  inAudience: boolean;
};

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "present", label: "Presentes" },
  { value: "absent", label: "Ausentes" },
] as const;

export function Roster({ eventId, rows, disabled }: { eventId: string; rows: RosterRow[]; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [marks, setMark] = useOptimistic(
    new Map(rows.map((r) => [r.id, r.attendance])),
    (state, { id, status }: { id: string; status: Mark }) => new Map(state).set(id, status),
  );
  const [visitorPhone, setVisitorPhone] = useState("");
  const q = useDeferredValue(query);
  const visitor = useAction(quickVisitorAction, { onSuccess: () => { setQuery(""); setVisitorPhone(""); } });
  const absentAll = useAction(markAllAbsentAction);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    for (const v of marks.values()) {
      if (v === "present") present++;
      else if (v === "absent") absent++;
    }
    return { present, absent, pending: rows.length - present - absent, total: rows.length };
  }, [marks, rows.length]);

  const visible = useMemo(() => {
    const n = normalizeSearch(q);
    return rows.filter((r) => {
      const m = marks.get(r.id) ?? null;
      if (filter === "pending" && m !== null) return false;
      if (filter === "present" && m !== "present") return false;
      if (filter === "absent" && m !== "absent") return false;
      return !n || normalizeSearch(r.fullName).includes(n) || normalizeSearch(r.preferredName ?? "").includes(n);
    });
  }, [rows, marks, q, filter]);

  function toggle(id: string, status: Mark) {
    const current = marks.get(id) ?? null;
    const next = current === status ? null : status;
    startTransition(async () => {
      setMark({ id, status: next });
      const r = await setAttendanceAction(eventId, id, next);
      if (!r.ok) toast.error(r.error);
      // Mantém o valor otimista até os dados novos do servidor chegarem.
      router.refresh();
    });
  }

  const pct = (n: number) => (counts.total ? (n / counts.total) * 100 : 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex gap-6 sm:gap-8">
            <Counter label="Presentes" value={counts.present} className="text-success" />
            <Counter label="Ausentes" value={counts.absent} className="text-destructive" />
            <Counter label="Pendentes" value={counts.pending} className="text-muted-foreground" />
          </div>
          {counts.pending > 0 && !disabled && (
            <Button variant="outline" size="sm" disabled={absentAll.pending} onClick={() => absentAll.run(eventId)}>
              Marcar pendentes como ausentes
            </Button>
          )}
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="bg-success transition-all duration-500" style={{ width: `${pct(counts.present)}%` }} />
          <div className="bg-destructive/70 transition-all duration-500" style={{ width: `${pct(counts.absent)}%` }} />
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-background/90 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <InputGroup className="h-11">
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pessoa pelo nome…" aria-label="Buscar na lista de presença" />
          {query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Limpar" onClick={() => setQuery("")}><X /></InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                filter === f.value ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
              )}
            >
              {f.label}
              <span className="ml-1.5 opacity-60 tabular">{f.value === "all" ? counts.total : counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        {visible.map((r) => {
          const m = marks.get(r.id) ?? null;
          return (
            <li key={r.id} className={cn("flex items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 sm:px-4", m === "present" && "bg-success/5")}>
              <PersonAvatar name={displayName(r)} seed={r.id} size="md" />
              <div className="min-w-0 flex-1">
                <Link href={`/pessoas/${r.id}`} className="block truncate font-medium hover:underline">{displayName(r)}</Link>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {r.status === "visitor" && <ToneBadge tone="gold" className="h-4 px-1.5 text-[10px]">visitante</ToneBadge>}
                  {!r.inAudience && <span>fora do público</span>}
                  {r.method === "qr" && m === "present" && <ToneBadge tone="sky" className="h-4 px-1.5 text-[10px]">via QR</ToneBadge>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={m === "present"}
                  aria-label={`Marcar ${displayName(r)} presente`}
                  onClick={() => toggle(r.id, "present")}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-all active:scale-95 disabled:opacity-40",
                    m === "present" ? "border-success bg-success text-background shadow-sm" : "hover:border-success/50 hover:bg-success/8",
                  )}
                >
                  <Check className="size-4" /> <span className="hidden sm:inline">Presente</span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={m === "absent"}
                  aria-label={`Marcar ${displayName(r)} ausente`}
                  onClick={() => toggle(r.id, "absent")}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-all active:scale-95 disabled:opacity-40",
                    m === "absent" ? "border-destructive bg-destructive text-background shadow-sm" : "hover:border-destructive/50 hover:bg-destructive/8",
                  )}
                >
                  <X className="size-4" /> <span className="hidden sm:inline">Ausente</span>
                </button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            {query ? `Ninguém chamado "${query}" na lista.` : "Ninguém neste filtro."}
          </li>
        )}
      </ul>

      {!disabled && (
        <form
          className="rounded-2xl border border-dashed bg-card/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            visitor.run(eventId, query, visitorPhone);
          }}
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-gold" /> Chegou alguém novo?</div>
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome do visitante" aria-label="Nome do visitante" />
            <Input value={visitorPhone} onChange={(e) => setVisitorPhone(e.target.value)} placeholder="Celular (opcional)" type="tel" aria-label="Celular do visitante" />
            <Button type="submit" disabled={visitor.pending || query.trim().length < 2}>
              {visitor.pending ? <Spinner /> : <><UserPlus data-icon="inline-start" /> Registrar visitante</>}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Counter({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className={cn("font-display text-4xl leading-none tabular", className)}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
