import { ArrowDownRight, ArrowRight, ArrowUpRight, CakeSlice, CalendarDays, HeartHandshake, Sparkles, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { AttendanceChart } from "@/components/charts/attendance-chart";
import { PageHeader, Section, StatCard } from "@/components/app/page-header";
import { ToneBadge, PersonAvatar } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { formatDate, formatDaysAgo, formatTime } from "@/lib/dates";
import { displayName, firstName } from "@/lib/text";
import { dashboardData } from "@/server/dashboard";
import { extendSeries, upcomingEvents } from "@/server/events";
import { requireUser } from "@/server/session";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const user = await requireUser();
  await extendSeries();
  const [data, upcoming] = await Promise.all([dashboardData(user), upcomingEvents(user, 4)]);
  const tz = data.settings.timezone;
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const delta = data.attendance.delta;

  return (
    <>
      <PageHeader
        eyebrow={formatDate(new Date(), tz, { weekday: "long", day: "numeric", month: "long" })}
        title={<>{greeting}, <span className="italic text-primary">{firstName(user.name)}</span></>}
        description={
          data.careTotal > 0
            ? `${data.careTotal} ${data.careTotal === 1 ? "pessoa está" : "pessoas estão"} há mais de ${data.settings.careThresholdDays} dias sem aparecer. Que tal um contato hoje?`
            : "Todo mundo tem aparecido. Que alegria!"
        }
        actions={
          <>
            <Button variant="outline" render={<Link href="/encontros?novo=1" />} nativeButton={false}>
              <CalendarDays data-icon="inline-start" /> Novo encontro
            </Button>
            <Button render={<Link href="/pessoas?novo=1" />} nativeButton={false}>
              <UserPlus data-icon="inline-start" /> Cadastrar pessoa
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pessoas ativas"
          value={data.counts.active}
          icon={<Users />}
          tone="ember"
          hint={`${data.counts.members} membros · ${data.counts.visitors} visitantes`}
        />
        <StatCard
          label="Média semanal"
          value={data.attendance.avgNow}
          icon={<CalendarDays />}
          tone="sky"
          hint={
            delta === null ? (
              "últimas 4 semanas"
            ) : (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", delta >= 0 ? "text-success" : "text-destructive")}>
                {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(Math.round(delta * 100))}% vs. 4 semanas antes
              </span>
            )
          }
        />
        <StatCard
          label="Visitantes novos"
          value={data.counts.newVisitors}
          icon={<Sparkles />}
          tone="gold"
          hint={`últimos 30 dias · ${data.counts.returningVisitors} voltaram`}
        />
        <StatCard
          label="Precisam de cuidado"
          value={data.careTotal}
          icon={<HeartHandshake />}
          tone="rose"
          hint={`${data.counts.myFollowUps} acompanhamentos seus abertos`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Section title="Frequência" description="Pessoas presentes por semana, nas últimas 12 semanas">
          <div className="px-3 pb-3">
            <AttendanceChart data={data.trend} />
          </div>
        </Section>

        <Section
          title="Próximos encontros"
          action={<Button variant="ghost" size="sm" render={<Link href="/encontros" />} nativeButton={false}>Agenda <ArrowRight data-icon="inline-end" /></Button>}
        >
          <ul className="divide-y px-2 pb-2">
            {upcoming.map((ev) => (
              <li key={ev.id}>
                <Link href={`/encontros/${ev.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60">
                  <DateTile date={ev.startsAt} tz={tz} tone={ev.category?.color ?? "ember"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{ev.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(ev.startsAt, tz, { weekday: "long" })} · {formatTime(ev.startsAt, tz)}
                      {ev.audience.length > 0 && ` · ${ev.audience.map((a) => a.ministry.name).join(", ")}`}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {upcoming.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum encontro agendado.</li>}
          </ul>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Section
          title="Precisam de cuidado"
          description={`Sem presença há ${data.settings.careThresholdDays}+ dias`}
          action={<Button variant="ghost" size="sm" render={<Link href="/cuidado" />} nativeButton={false}>Ver todos</Button>}
        >
          <PeopleList
            empty="Ninguém sumido por enquanto."
            items={data.care.map((p) => ({
              id: p.id,
              name: displayName(p),
              meta: p.neverSeen ? "nunca registrou presença" : `última vez ${formatDaysAgo(p.absentDays)}`,
              badge: p.hasFollowUp ? <ToneBadge tone="sage">em contato</ToneBadge> : null,
            }))}
          />
        </Section>

        <Section title="Visitantes recentes" description="Primeira visita nos últimos 30 dias">
          <PeopleList
            empty="Nenhum visitante novo."
            items={data.newVisitors.map((p) => ({
              id: p.id,
              name: displayName(p),
              meta: `1ª visita em ${formatDate(p.firstVisitDate!, tz, { day: "2-digit", month: "short" })}`,
              badge:
                p.visits >= 2 ? <ToneBadge tone="sage">voltou {p.visits}×</ToneBadge> : <ToneBadge tone="gold">1ª vez</ToneBadge>,
            }))}
          />
        </Section>

        <Section title="Aniversariantes" description="Próximos 14 dias">
          <PeopleList
            empty="Nenhum aniversário nos próximos dias."
            items={data.birthdays.map((p) => ({
              id: p.id,
              name: displayName(p),
              meta: `${formatDate(p.birthDate!, tz, { day: "2-digit", month: "long" })} · faz ${(p.age ?? 0) + (p.inDays === 0 ? 0 : 1)} anos`,
              badge:
                p.inDays === 0 ? (
                  <ToneBadge tone="ember"><CakeSlice className="size-3" /> hoje!</ToneBadge>
                ) : (
                  <span className="text-xs text-muted-foreground tabular">em {p.inDays}d</span>
                ),
            }))}
          />
        </Section>
      </div>
    </>
  );
}

function DateTile({ date, tz, tone }: { date: Date; tz: string; tone: string }) {
  return (
    <div data-tone={tone} className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-tone/12 text-tone">
      <span className="text-[10px] font-semibold uppercase leading-none">{formatDate(date, tz, { month: "short" }).replace(".", "")}</span>
      <span className="font-display text-xl leading-none">{formatDate(date, tz, { day: "numeric" })}</span>
    </div>
  );
}

function PeopleList({
  items,
  empty,
}: {
  items: { id: string; name: string; meta: string; badge?: React.ReactNode }[];
  empty: string;
}) {
  if (!items.length) return <p className="px-5 pt-2 pb-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="px-2 pb-2">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={`/pessoas/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/60">
            <PersonAvatar name={p.name} seed={p.id} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.meta}</div>
            </div>
            {p.badge}
          </Link>
        </li>
      ))}
    </ul>
  );
}
