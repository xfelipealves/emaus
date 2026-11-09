import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ToneBadge, ToneDot } from "@/components/app/tone";
import { EventSheet } from "@/components/events/event-form";
import { Button } from "@/components/ui/button";
import { addDaysIso, formatDate, formatTime, isoDateInTz, startOfDayUtc, todayIso, upperFirst, weekdayOfIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { extendSeries, listCategories, listEvents } from "@/server/events";
import { listMinistries } from "@/server/ministries";
import { can, requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Encontros" };

type Search = { view?: string; mes?: string; novo?: string };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  await extendSeries();
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayIso(tz);
  const view = params.view === "calendario" ? "calendar" : "list";
  const [categories, ministries] = await Promise.all([listCategories(), listMinistries(user)]);

  return (
    <>
      <PageHeader
        title="Encontros"
        description="Cultos, células e eventos. Abra um encontro para lançar a presença ou ativar o check-in por QR Code."
        actions={
          <>
            <div className="flex rounded-lg border bg-card p-0.5">
              <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" render={<Link href="/encontros" />} nativeButton={false}>
                <List data-icon="inline-start" /> Lista
              </Button>
              <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" render={<Link href="/encontros?view=calendario" />} nativeButton={false}>
                <CalendarDays data-icon="inline-start" /> Calendário
              </Button>
            </div>
            {can.manageEvents(user) && (
              <EventSheet
                categories={categories}
                ministries={ministries.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
                defaultOpen={params.novo === "1"}
                today={today}
              />
            )}
          </>
        }
      />
      {view === "calendar" ? (
        <CalendarView month={params.mes ?? today.slice(0, 7)} today={today} tz={tz} />
      ) : (
        <ListView today={today} tz={tz} />
      )}
    </>
  );
}

async function ListView({ today, tz }: { today: string; tz: string }) {
  const user = await requireUser();
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    listEvents(user, { from: startOfDayUtc(today, tz), to: startOfDayUtc(addDaysIso(today, 35), tz) }),
    listEvents(user, { from: startOfDayUtc(addDaysIso(today, -42), tz), to: startOfDayUtc(today, tz) }),
  ]);
  const groups = Map.groupBy(upcoming, (e) => isoDateInTz(e.startsAt, tz));

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <section className="space-y-6">
        {[...groups.entries()].map(([day, events]) => (
          <div key={day}>
            <h2 className="sticky top-0 z-10 -mx-1 mb-2 flex items-baseline gap-2 bg-background/90 px-1 py-1.5 backdrop-blur">
              <span className="font-display text-2xl">{day === today ? "Hoje" : day === addDaysIso(today, 1) ? "Amanhã" : formatDate(day, tz, { weekday: "long" })}</span>
              <span className="text-sm text-muted-foreground">{formatDate(day, tz, { day: "numeric", month: "long" })}</span>
            </h2>
            <ul className="space-y-2">
              {events.map((ev) => {
                const live = ev.startsAt <= now && (ev.endsAt ?? ev.startsAt) >= now;
                return (
                  <li key={ev.id}>
                    <Link
                      href={`/encontros/${ev.id}`}
                      data-tone={ev.category?.color ?? "ember"}
                      className={cn(
                        "group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                        ev.cancelled && "opacity-60",
                      )}
                    >
                      <div className="w-14 shrink-0 text-center">
                        <div className="font-display text-2xl leading-none tabular">{formatTime(ev.startsAt, tz)}</div>
                      </div>
                      <div className="h-10 w-1 shrink-0 rounded-full bg-tone" />
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate font-medium", ev.cancelled && "line-through")}>{ev.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {ev.category && <span className="inline-flex items-center gap-1.5"><ToneDot tone={ev.category.color} />{ev.category.name}</span>}
                          {ev.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{ev.location}</span>}
                          <span className="inline-flex items-center gap-1"><Users className="size-3" />{ev.audience.length ? ev.audience.map((a) => a.ministry.name).join(", ") : "Igreja toda"}</span>
                        </div>
                      </div>
                      {ev.cancelled ? <ToneBadge tone="slate">cancelado</ToneBadge> : live ? <ToneBadge tone="rose"><span className="size-1.5 animate-pulse rounded-full bg-tone" /> agora</ToneBadge> : ev.checkinOpen ? <ToneBadge tone="sky">QR aberto</ToneBadge> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {groups.size === 0 && <p className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">Nenhum encontro nas próximas semanas.</p>}
      </section>

      <aside>
        <h2 className="mb-3 text-sm font-semibold">Encontros anteriores</h2>
        <ul className="divide-y rounded-2xl border bg-card shadow-xs">
          {past.reverse().filter((e) => !e.cancelled).slice(0, 12).map((ev) => (
            <li key={ev.id}>
              <Link href={`/encontros/${ev.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <ToneDot tone={ev.category?.color ?? "ember"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{ev.title}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(ev.startsAt, tz, { weekday: "short", day: "2-digit", month: "short" })}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl leading-none tabular">{ev.present}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">presentes</div>
                </div>
              </Link>
            </li>
          ))}
          {past.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nada por aqui ainda.</li>}
        </ul>
      </aside>
    </div>
  );
}

async function CalendarView({ month, today, tz }: { month: string; today: string; tz: string }) {
  const user = await requireUser();
  const first = `${month}-01`;
  const gridStart = addDaysIso(first, -weekdayOfIso(first));
  const days = Array.from({ length: 42 }, (_, i) => addDaysIso(gridStart, i));
  const events = await listEvents(user, { from: startOfDayUtc(days[0], tz), to: startOfDayUtc(addDaysIso(days[41], 1), tz) });
  const byDay = Map.groupBy(events, (e) => isoDateInTz(e.startsAt, tz));
  const [y, m] = month.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-display text-2xl">{upperFirst(formatDate(first, tz, { month: "long", year: "numeric" }))}</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Mês anterior" render={<Link href={`/encontros?view=calendario&mes=${prev}`} />} nativeButton={false}><ChevronLeft /></Button>
          <Button variant="ghost" size="sm" render={<Link href="/encontros?view=calendario" />} nativeButton={false}>Hoje</Button>
          <Button variant="ghost" size="icon" aria-label="Próximo mês" render={<Link href={`/encontros?view=calendario&mes=${next}`} />} nativeButton={false}><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = byDay.get(day) ?? [];
          const inMonth = day.startsWith(month);
          return (
            <div key={day} className={cn("min-h-20 border-b p-1 sm:min-h-28 sm:p-1.5", i % 7 !== 6 && "border-r", !inMonth && "bg-muted/30")}>
              <div className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular", day === today ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "" : "text-muted-foreground/60")}>
                {Number(day.slice(8))}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/encontros/${ev.id}`}
                    data-tone={ev.category?.color ?? "ember"}
                    className={cn("block truncate rounded-md bg-tone/12 px-1.5 py-0.5 text-[11px] font-medium text-tone hover:bg-tone/20", ev.cancelled && "line-through opacity-50")}
                  >
                    <span className="hidden sm:inline">{formatTime(ev.startsAt, tz)} </span>{ev.title}
                  </Link>
                ))}
                {items.length > 3 && <div className="px-1.5 text-[11px] text-muted-foreground">+{items.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
