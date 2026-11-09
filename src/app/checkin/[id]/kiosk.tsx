"use client";

import { ArrowLeft, Check, Delete, Maximize, Search, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/app/logo";
import { PersonAvatar } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { PersonStatus } from "@/db/schema";
import { displayName, firstName, normalizeSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import { quickVisitorAction, setAttendanceAction } from "@/app/(app)/encontros/actions";

type P = { id: string; fullName: string; preferredName: string | null; status: PersonStatus; present: boolean };

export function Kiosk({ eventId, churchName, title, when, people }: { eventId: string; churchName: string; title: string; when: string; people: P[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [present, setPresent] = useState(() => new Set(people.filter((p) => p.present).map((p) => p.id)));
  const [welcome, setWelcome] = useState<string | null>(null);
  const [visitorOpen, setVisitorOpen] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(() => setWelcome(null), 2200);
    return () => clearTimeout(t);
  }, [welcome]);

  const results = useMemo(() => {
    const n = normalizeSearch(query);
    if (n.length < 2) return [];
    return people
      .filter((p) => normalizeSearch(p.fullName).split(" ").some((w) => w.startsWith(n)) || normalizeSearch(p.fullName).includes(n) || normalizeSearch(p.preferredName ?? "").includes(n))
      .slice(0, 12);
  }, [query, people]);

  function checkIn(p: P) {
    if (present.has(p.id)) {
      setWelcome(`${firstName(displayName(p))} já está aqui 🙂`);
      setQuery("");
      return;
    }
    start(async () => {
      const r = await setAttendanceAction(eventId, p.id, "present", "kiosk");
      if (!r.ok) return void toast.error(r.error);
      setPresent((s) => new Set(s).add(p.id));
      setWelcome(`Que bom te ver, ${firstName(displayName(p))}!`);
      setQuery("");
      inputRef.current?.focus();
    });
  }

  return (
    <main className="paper flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-10 sm:pt-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Voltar" render={<Link href={`/encontros/${eventId}`} />} nativeButton={false}><ArrowLeft /></Button>
          <LogoMark className="size-9" />
          <div className="leading-tight">
            <div className="text-sm font-medium">{churchName}</div>
            <div className="text-xs text-muted-foreground">{title} · {when}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-display text-4xl leading-none tabular text-success">{present.size}</div>
            <div className="text-xs text-muted-foreground">presentes</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Tela cheia" className="hidden sm:inline-flex" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize /></Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-10 pb-8 sm:pt-16">
        <h1 className="text-center font-display text-4xl text-balance sm:text-6xl">Bem-vindo! <span className="italic text-primary">Digite seu nome</span></h1>
        <div className="relative mt-8">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-6 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="Comece a digitar…"
            aria-label="Seu nome"
            className="h-16 w-full rounded-2xl border-2 bg-card pr-14 pl-14 text-2xl shadow-sm outline-none transition-colors focus:border-primary sm:h-20 sm:text-3xl"
          />
          {query && (
            <button type="button" aria-label="Apagar" onClick={() => setQuery("")} className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full p-2 text-muted-foreground hover:bg-muted">
              <Delete className="size-6" />
            </button>
          )}
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {results.map((p) => {
            const here = present.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => checkIn(p)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left shadow-xs transition-all active:scale-[0.98]",
                    here ? "border-success/40 bg-success/5" : "hover:border-primary",
                  )}
                >
                  <PersonAvatar name={displayName(p)} seed={p.id} size="lg" className="size-14 text-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-semibold">{displayName(p)}</div>
                    <div className="text-sm text-muted-foreground">{here ? "Presença confirmada" : "Toque para confirmar presença"}</div>
                  </div>
                  {here && <Check className="size-7 text-success" />}
                </button>
              </li>
            );
          })}
        </ul>

        {query.trim().length >= 2 && (
          <button
            type="button"
            onClick={() => setVisitorOpen(true)}
            className="mx-auto mt-6 flex items-center gap-2 rounded-full border-2 border-dashed px-6 py-3 text-lg font-medium text-muted-foreground transition-colors hover:border-gold hover:text-foreground"
          >
            <Sparkles className="size-5 text-gold" /> É sua primeira vez aqui?
          </button>
        )}
      </section>

      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-10 mx-auto flex w-fit items-center gap-3 rounded-full bg-success px-7 py-4 text-xl font-semibold text-background shadow-2xl transition-all duration-300",
          welcome ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        )}
      >
        <Check className="size-6" /> {welcome}
      </div>

      <VisitorDialog
        open={visitorOpen}
        onOpenChange={setVisitorOpen}
        defaultName={query}
        onSubmit={async (name, phone) => {
          const r = await quickVisitorAction(eventId, name, phone, "kiosk");
          if (!r.ok) return toast.error(r.error);
          setVisitorOpen(false);
          setQuery("");
          setWelcome(`Seja muito bem-vindo, ${firstName(name)}!`);
          router.refresh();
        }}
      />
    </main>
  );
}

function VisitorDialog({ open, onOpenChange, defaultName, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; defaultName: string; onSubmit: (name: string, phone: string) => Promise<unknown> }) {
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">Que alegria ter você aqui!</DialogTitle>
        </DialogHeader>
        <form
          id="kiosk-visitor"
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => { await onSubmit(String(f.get("name")), String(f.get("phone") ?? "")); });
          }}
        >
          <Input name="name" defaultValue={defaultName} placeholder="Seu nome completo" required className="h-12 text-lg" />
          <Input name="phone" type="tel" inputMode="tel" placeholder="Celular com DDD (opcional)" className="h-12 text-lg" />
        </form>
        <DialogFooter>
          <Button type="submit" form="kiosk-visitor" size="lg" className="h-12 w-full text-base" disabled={pending}>
            {pending ? <Spinner /> : <><UserPlus data-icon="inline-start" /> Confirmar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
