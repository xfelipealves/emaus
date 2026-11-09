import { ArrowRightLeft, CalendarCheck, CalendarX, Crown, Gift, HeartHandshake, House, Lock, Mail, MapPin, MessageCircle, Network, Phone, Pin, Sparkles, StickyNote, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonAvatar, ToneBadge, ToneDot } from "@/components/app/tone";
import { FollowUpItem, NewFollowUpButton } from "@/components/people/follow-ups";
import { AddToMinistry, MembershipMenu } from "@/components/people/memberships";
import { NoteComposer, NoteMenu } from "@/components/people/notes";
import { PersonActions } from "@/components/people/person-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDaysIso, diffDaysIso, formatDate, formatDateTime, formatDaysAgo, isoDateInTz, todayIso } from "@/lib/dates";
import { HOUSEHOLD_ROLE_LABEL } from "@/lib/labels";
import { displayName, firstName, formatPhone, whatsappUrl } from "@/lib/text";
import { cn } from "@/lib/utils";
import { listAssignees, listFollowUps } from "@/server/care";
import { listHouseholds } from "@/server/households";
import { listMinistries } from "@/server/ministries";
import { getPerson, personAttendance, personTimeline } from "@/server/people";
import { can, requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await requireUser();
  const person = await getPerson(user, (await params).id);
  return { title: person ? displayName(person) : "Pessoa" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const person = await getPerson(user, id);
  if (!person) notFound();

  const [settings, timeline, attendance, followUps, doneFollowUps, ministries, households, assignees] = await Promise.all([
    getSettings(),
    personTimeline(id, user.role === "admin"),
    personAttendance(id, 200),
    listFollowUps(user, { personId: id }),
    listFollowUps(user, { personId: id, done: true }),
    listMinistries(user),
    listHouseholds(user),
    listAssignees(),
  ]);
  const tz = settings.timezone;
  const today = todayIso(tz);
  const name = displayName(person);
  const wa = whatsappUrl(person.phone);
  const present = attendance.filter((a) => a.status === "present");
  const lastSeen = present[0]?.startsAt ?? null;
  const since90 = present.filter((a) => diffDaysIso(today, isoDateInTz(a.startsAt, tz)) <= 90).length;
  const activeMemberships = person.memberships.filter((m) => !m.endDate);
  const pastMemberships = person.memberships.filter((m) => m.endDate);
  const availableMinistries = ministries.filter((m) => !activeMemberships.some((am) => am.ministryId === m.id));

  // Grade de 20 semanas: presença em qualquer encontro da semana.
  const weeks = Array.from({ length: 20 }, (_, i) => {
    const start = addDaysIso(today, -(19 - i) * 7 - 6);
    const end = addDaysIso(start, 6);
    const hits = attendance.filter((a) => {
      const d = isoDateInTz(a.startsAt, tz);
      return d >= start && d <= end;
    });
    return {
      start,
      present: hits.filter((h) => h.status === "present").length,
      absent: hits.filter((h) => h.status === "absent").length,
    };
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <section className="relative overflow-hidden rounded-3xl border bg-card shadow-xs">
        <div className="paper absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4 sm:items-center sm:gap-5">
            <PersonAvatar name={name} seed={person.id} size="xl" className="max-sm:size-16 max-sm:text-xl" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={person.status} />
                {activeMemberships.some((m) => m.role === "leader") && (
                  <ToneBadge tone="gold"><Crown className="size-3" /> Liderança</ToneBadge>
                )}
              </div>
              <h1 className="font-display text-3xl leading-tight sm:text-4xl">{name}</h1>
              <p className="text-sm text-muted-foreground">
                {[
                  person.preferredName ? person.fullName : null,
                  person.age !== null ? `${person.age} anos` : null,
                  person.household ? person.household.name : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && (
              <Button variant="outline" render={<a href={wa} target="_blank" rel="noreferrer" />} nativeButton={false}>
                <MessageCircle data-icon="inline-start" /> WhatsApp
              </Button>
            )}
            <NewFollowUpButton personId={person.id} assignees={assignees} currentUserId={user.id} />
            <PersonActions
              person={{ ...person }}
              households={households.map((h) => ({ id: h.id, name: h.name }))}
              canDelete={can.deletePeople(user)}
            />
          </div>
        </div>
        <dl className="relative grid grid-cols-2 border-t sm:grid-cols-4 [&>div]:px-5 [&>div]:py-3.5 sm:[&>div]:px-7 [&>div+div]:border-l max-sm:[&>div:nth-child(3)]:border-l-0 max-sm:[&>div:nth-child(n+3)]:border-t">
          <div>
            <dt className="text-xs text-muted-foreground">Última presença</dt>
            <dd className="mt-0.5 text-sm font-medium">{lastSeen ? formatDaysAgo(diffDaysIso(today, isoDateInTz(lastSeen, tz))) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Presenças (90 dias)</dt>
            <dd className="mt-0.5 text-sm font-medium tabular">{since90}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{person.status === "visitor" ? "Primeira visita" : "Membro desde"}</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {formatDate(person.status === "visitor" ? person.firstVisitDate : (person.memberSince ?? person.firstVisitDate))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ministérios</dt>
            <dd className="mt-0.5 text-sm font-medium tabular">{activeMemberships.length}</dd>
          </div>
        </dl>
      </section>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b pb-0">
          <TabsTrigger value="overview" className="flex-none px-3">Visão geral</TabsTrigger>
          <TabsTrigger value="timeline" className="flex-none px-3">Linha do tempo</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-none px-3">Frequência</TabsTrigger>
          <TabsTrigger value="ministries" className="flex-none px-3">Ministérios</TabsTrigger>
        </TabsList>

        {/* Visão geral */}
        <TabsContent value="overview" className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <Section title="Contato e dados">
              <dl className="space-y-3 px-5 pb-5 text-sm">
                <Info icon={Phone} label="Celular">{formatPhone(person.phone)}</Info>
                <Info icon={Mail} label="E-mail">{person.email}</Info>
                <Info icon={Gift} label="Nascimento">
                  {person.birthDate && `${formatDate(person.birthDate, tz, { day: "2-digit", month: "long", year: "numeric" })}`}
                </Info>
                <Info icon={MapPin} label="Endereço">{person.address}</Info>
                {person.howFound && <Info icon={Sparkles} label="Como conheceu">{person.howFound}</Info>}
              </dl>
            </Section>

            <Section
              title="Família"
              action={person.household && <Button variant="ghost" size="sm" render={<Link href={`/familias/${person.household.id}`} />} nativeButton={false}>Abrir</Button>}
            >
              {person.household ? (
                <ul className="px-2 pb-2">
                  {person.household.members
                    .sort((a, b) => ["head", "spouse", "child", "other"].indexOf(a.householdRole ?? "other") - ["head", "spouse", "child", "other"].indexOf(b.householdRole ?? "other"))
                    .map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/pessoas/${m.id}`}
                          className={cn("flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/60", m.id === person.id && "bg-muted/50")}
                        >
                          <PersonAvatar name={displayName(m)} seed={m.id} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{displayName(m)}</div>
                            <div className="text-xs text-muted-foreground">{HOUSEHOLD_ROLE_LABEL[m.householdRole ?? "other"]}</div>
                          </div>
                          <StatusBadge status={m.status} />
                        </Link>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-sm text-muted-foreground">
                  Sem família vinculada. Use <span className="font-medium text-foreground">Editar</span> para vincular.
                </p>
              )}
            </Section>
          </div>

          <div className="space-y-4">
            <Section
              title="Acompanhamentos"
              description={followUps.length ? `${followUps.length} em aberto` : "Nada pendente"}
              action={<NewFollowUpButton personId={person.id} assignees={assignees} currentUserId={user.id} label="Novo" />}
            >
              {followUps.length > 0 ? (
                <ul className="divide-y border-t">{followUps.map((f) => <FollowUpItem key={f.id} item={f} today={today} />)}</ul>
              ) : (
                <p className="px-5 pb-5 text-sm text-muted-foreground">Crie um lembrete para ligar, visitar ou orar por {firstName(name)}.</p>
              )}
            </Section>

            <NoteComposer personId={person.id} firstName={firstName(name)} canPastoral={user.role === "admin"} />

            {timeline.pinned.map((n) => (
              <article key={n.id} className="relative rounded-2xl border border-gold/30 bg-[color-mix(in_oklch,var(--c-gold)_8%,var(--card))] p-4 pr-12">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Pin className="size-3" /> Fixada{n.visibility === "pastoral" && <><Lock className="ml-1 size-3" /> confidencial</>}</div>
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                <div className="mt-2 text-xs text-muted-foreground">{n.author?.name ?? "—"} · {formatDate(n.createdAt, tz)}</div>
                <NoteMenu id={n.id} content={n.content} pinned canEdit={n.authorId === user.id || user.role === "admin"} />
              </article>
            ))}

            <Section title="Atividade recente">
              <Timeline items={timeline.items.slice(0, 6)} tz={tz} userId={user.id} isAdmin={user.role === "admin"} />
            </Section>
          </div>
        </TabsContent>

        {/* Linha do tempo */}
        <TabsContent value="timeline" className="mt-5 max-w-3xl space-y-4">
          <NoteComposer personId={person.id} firstName={firstName(name)} canPastoral={user.role === "admin"} />
          <Timeline items={timeline.items} tz={tz} userId={user.id} isAdmin={user.role === "admin"} full />
          {doneFollowUps.length > 0 && (
            <Section title="Acompanhamentos concluídos">
              <ul className="divide-y border-t">{doneFollowUps.map((f) => <FollowUpItem key={f.id} item={f} today={today} />)}</ul>
            </Section>
          )}
        </TabsContent>

        {/* Frequência */}
        <TabsContent value="attendance" className="mt-5 space-y-4">
          <Section title="Últimas 20 semanas" description="Cada quadrado é uma semana. Quanto mais forte, mais encontros com presença.">
            <div className="flex flex-wrap gap-1.5 px-5 pb-5">
              {weeks.map((w) => (
                <div
                  key={w.start}
                  title={`Semana de ${formatDate(w.start, tz, { day: "2-digit", month: "short" })}: ${w.present} presença(s)`}
                  className={cn(
                    "size-7 rounded-md border sm:size-8",
                    w.present === 0 && w.absent === 0 && "bg-muted/50",
                    w.present === 0 && w.absent > 0 && "border-destructive/30 bg-destructive/10",
                    w.present === 1 && "border-transparent bg-primary/35",
                    w.present === 2 && "border-transparent bg-primary/65",
                    w.present >= 3 && "border-transparent bg-primary",
                  )}
                />
              ))}
            </div>
          </Section>
          <Section title="Histórico de encontros" description={`${present.length} presenças registradas`}>
            {attendance.length ? (
              <ul className="divide-y border-t">
                {attendance.map((a) => (
                  <li key={a.eventId}>
                    <Link href={`/encontros/${a.eventId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/50">
                      {a.status === "present" ? <CalendarCheck className="size-4 text-success" /> : <CalendarX className="size-4 text-destructive" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(a.startsAt, tz)}</div>
                      </div>
                      {a.method === "qr" && <ToneBadge tone="sky">QR</ToneBadge>}
                      <span className={cn("text-xs font-medium", a.status === "present" ? "text-success" : "text-destructive")}>
                        {a.status === "present" ? "Presente" : "Ausente"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma presença registrada ainda.</p>
            )}
          </Section>
        </TabsContent>

        {/* Ministérios */}
        <TabsContent value="ministries" className="mt-5 space-y-4">
          <Section title="Ministérios atuais" action={<AddToMinistry personId={person.id} ministries={availableMinistries} />}>
            {activeMemberships.length ? (
              <ul className="divide-y border-t">
                {activeMemberships.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <span data-tone={m.ministry.color} className="flex size-9 items-center justify-center rounded-xl bg-tone/12 text-tone"><Network className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/ministerios/${m.ministryId}`} className="text-sm font-medium hover:underline">{m.ministry.name}</Link>
                      <div className="text-xs text-muted-foreground">desde {formatDate(m.startDate, tz)}</div>
                    </div>
                    {m.role === "leader" && <ToneBadge tone="gold"><Crown className="size-3" /> Líder</ToneBadge>}
                    <MembershipMenu id={m.id} role={m.role} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">Ainda não participa de nenhum ministério.</p>
            )}
          </Section>
          {pastMemberships.length > 0 && (
            <Section title="Histórico">
              <ul className="divide-y border-t">
                {pastMemberships.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <ToneDot tone={m.ministry.color} />
                    <span className="flex-1">{m.ministry.name}{m.role === "leader" && " (líder)"}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(m.startDate, tz)} – {formatDate(m.endDate, tz)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">{children || <span className="text-muted-foreground">Não informado</span>}</dd>
      </div>
    </div>
  );
}

const EVENT_ICON = {
  registered: UserPlus,
  status: ArrowRightLeft,
  ministry: Network,
  household: House,
  follow_up: HeartHandshake,
  profile: StickyNote,
} as const;

type TimelineItems = Awaited<ReturnType<typeof personTimeline>>["items"];

function Timeline({ items, tz, userId, isAdmin, full }: { items: TimelineItems; tz: string; userId: string; isAdmin: boolean; full?: boolean }) {
  if (!items.length) return <p className="px-5 pb-5 text-sm text-muted-foreground">Nada registrado ainda.</p>;
  return (
    <ol className={cn("relative space-y-1", full ? "pl-1" : "px-3 pb-3")}>
      <span className="absolute top-3 bottom-3 left-[1.15rem] w-px bg-border" aria-hidden />
      {items.map((item) => {
        if (item.type === "attendance") {
          return (
            <li key={`a-${item.id}`} className="relative flex items-center gap-3 py-1.5 pl-1">
              <span className={cn("z-10 flex size-7 items-center justify-center rounded-full border bg-card", item.status === "present" ? "text-success" : "text-destructive")}>
                {item.status === "present" ? <CalendarCheck className="size-3.5" /> : <CalendarX className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.status === "present" ? "Presente em " : "Ausente em "}
                <span className="font-medium">{item.title}</span>
              </span>
              <time className="shrink-0 text-xs text-muted-foreground">{formatDate(item.at, tz, { day: "2-digit", month: "short" })}</time>
            </li>
          );
        }
        if (item.type === "note") {
          return (
            <li key={`n-${item.id}`} className="relative flex gap-3 py-2 pl-1">
              <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-gold"><StickyNote className="size-3.5" /></span>
              <article className="relative min-w-0 flex-1 rounded-xl border bg-card p-3 pr-10 shadow-xs">
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {item.pastoral && <><Lock className="size-3" /> Confidencial ·</>}
                  {item.author ?? "—"} · {formatDateTime(item.at, tz)}{item.editedAt && " · editada"}
                </div>
                <NoteMenu id={item.id} content={item.content} pinned={item.pinned} canEdit={isAdmin || item.authorId === userId} />
              </article>
            </li>
          );
        }
        const Icon = EVENT_ICON[item.kind as keyof typeof EVENT_ICON] ?? StickyNote;
        return (
          <li key={`e-${item.id}`} className="relative flex items-start gap-3 py-1.5 pl-1">
            <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-primary"><Icon className="size-3.5" /></span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-sm font-medium">{item.title}</div>
              {item.detail && <div className="text-xs text-muted-foreground">{item.detail}</div>}
              {item.actor && <div className="text-xs text-muted-foreground">por {item.actor}</div>}
            </div>
            <time className="shrink-0 pt-1 text-xs text-muted-foreground">{formatDate(item.at, tz, { day: "2-digit", month: "short", year: "2-digit" })}</time>
          </li>
        );
      })}
    </ol>
  );
}
