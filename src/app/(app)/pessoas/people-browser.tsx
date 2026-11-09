"use client";

import { Download, MessageCircle, Search, Upload, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonAvatar, ToneBadge } from "@/components/app/tone";
import { PersonSheet } from "@/components/people/person-sheet";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PersonStatus } from "@/db/schema";
import { formatDaysAgo } from "@/lib/dates";
import { displayName, formatPhone, normalizePhone, normalizeSearch, whatsappUrl } from "@/lib/text";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  fullName: string;
  preferredName: string | null;
  status: PersonStatus;
  phone: string | null;
  age: number | null;
  householdName: string | null;
  daysSinceSeen: number | null;
  visits: number;
  ministries: { ministryId: string; name: string; color: string; role: "member" | "leader" }[];
};

const TABS = [
  { value: "all", label: "Todos" },
  { value: "member", label: "Membros" },
  { value: "visitor", label: "Visitantes" },
  { value: "inactive", label: "Inativos" },
] as const;

export function PeopleBrowser({
  people,
  ministries,
  households,
  canImport,
  openNew,
  initialStatus,
  initialMinistry,
}: {
  people: Row[];
  ministries: { id: string; name: string; color: string }[];
  households: { id: string; name: string }[];
  canImport: boolean;
  openNew: boolean;
  initialStatus?: string;
  initialMinistry?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(initialStatus ?? "all");
  const [ministry, setMinistry] = useState(initialMinistry ?? "");
  const [sheetOpen, setSheetOpen] = useState(openNew);
  const q = useDeferredValue(query);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: people.length, member: 0, visitor: 0, inactive: 0 };
    for (const p of people) c[p.status]++;
    return c;
  }, [people]);

  const filtered = useMemo(() => {
    const needle = normalizeSearch(q);
    const digits = normalizePhone(q);
    return people.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (ministry && !p.ministries.some((m) => m.ministryId === ministry)) return false;
      if (!needle) return true;
      return (
        normalizeSearch(p.fullName).includes(needle) ||
        normalizeSearch(p.preferredName ?? "").includes(needle) ||
        (digits.length >= 3 && normalizePhone(p.phone ?? "").includes(digits))
      );
    });
  }, [people, q, status, ministry]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <InputGroup className="h-10 lg:max-w-sm">
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            aria-label="Buscar pessoas"
          />
          {query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Limpar busca" onClick={() => setQuery("")}><X /></InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <NativeSelect value={ministry} onChange={(e) => setMinistry(e.target.value)} className="lg:w-52" aria-label="Filtrar por ministério">
          <option value="">Todos os ministérios</option>
          {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </NativeSelect>
        <div className="flex gap-2 lg:ml-auto">
          {canImport && (
            <>
              <Button variant="outline" size="lg" render={<Link href="/pessoas/importar" />} nativeButton={false}>
                <Upload data-icon="inline-start" /> Importar
              </Button>
              <Button variant="outline" size="lg" render={<a href="/api/export/pessoas" />} nativeButton={false}>
                <Download data-icon="inline-start" /> Exportar
              </Button>
            </>
          )}
          <Button size="lg" className="ml-auto" onClick={() => setSheetOpen(true)}>
            <UserPlus data-icon="inline-start" /> Nova pessoa
          </Button>
        </div>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(String(v))}>
        <TabsList className="h-9! w-full overflow-x-auto sm:w-fit">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-3">
              {t.label}
              <span className="ml-1 text-xs text-muted-foreground tabular">{counts[t.value]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>{people.length ? "Ninguém encontrado" : "Nenhuma pessoa ainda"}</EmptyTitle>
            <EmptyDescription>
              {people.length ? "Tente outro nome ou limpe os filtros." : "Cadastre a primeira pessoa ou importe uma planilha."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setSheetOpen(true)}><UserPlus data-icon="inline-start" /> Nova pessoa</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_2.5rem] gap-4 border-b bg-muted/40 px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
            <span>Nome</span>
            <span>Status</span>
            <span>Ministérios</span>
            <span>Última presença</span>
            <span />
          </div>
          <ul className="divide-y">
            {filtered.map((p) => {
              const wa = whatsappUrl(p.phone);
              return (
                <li key={p.id} className="group relative">
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/pessoas/${p.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/pessoas/${p.id}`)}
                    className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_2.5rem] md:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <PersonAvatar name={displayName(p)} seed={p.id} size="md" />
                      <div className="min-w-0">
                        <Link href={`/pessoas/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium hover:underline">
                          {displayName(p)}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">
                          {[p.preferredName ? p.fullName : null, p.age !== null ? `${p.age} anos` : null, formatPhone(p.phone), p.householdName]
                            .filter(Boolean)
                            .join(" · ") || "Sem dados de contato"}
                        </div>
                      </div>
                    </div>
                    <div className="md:order-none"><StatusBadge status={p.status} /></div>
                    <div className="col-span-2 flex flex-wrap gap-1 pl-13 md:col-span-1 md:pl-0">
                      {p.ministries.slice(0, 3).map((m) => (
                        <ToneBadge key={m.ministryId} tone={m.color}>{m.name}{m.role === "leader" && " ★"}</ToneBadge>
                      ))}
                      {p.ministries.length > 3 && <span className="text-xs text-muted-foreground">+{p.ministries.length - 3}</span>}
                    </div>
                    <div className={cn("hidden text-sm md:block", p.daysSinceSeen !== null && p.daysSinceSeen > 21 && p.status !== "inactive" && "text-destructive")}>
                      {p.daysSinceSeen === null ? <span className="text-muted-foreground">—</span> : formatDaysAgo(p.daysSinceSeen)}
                    </div>
                    <div className="hidden justify-end md:flex">
                      {wa && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Abrir WhatsApp"
                          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          render={<a href={wa} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} />}
                          nativeButton={false}
                        >
                          <MessageCircle />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
            {filtered.length} de {people.length} pessoas
          </div>
        </div>
      )}

      <PersonSheet open={sheetOpen} onOpenChange={setSheetOpen} households={households} />
    </div>
  );
}
