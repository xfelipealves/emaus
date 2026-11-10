import { Archive, ArchiveRestore, Crown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendChart } from "@/components/charts/attendance-chart";
import { PageHeader, Section, StatCard } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonAvatar, ToneBadge } from "@/components/app/tone";
import { MembershipMenu } from "@/components/people/memberships";
import { formatDate } from "@/lib/dates";
import { displayName } from "@/lib/text";
import { getMinistry, ministryAttendanceTrend } from "@/server/ministries";
import { listPeople } from "@/server/people";
import { can, requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { MinistryDialog } from "../ministry-dialog";
import { AddMembers, ArchiveButton } from "./client";

export const metadata: Metadata = { title: "Ministério" };

export default async function MinistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ministry = await getMinistry(user, id);
  if (!ministry) notFound();
  const [settings, trend, people] = await Promise.all([getSettings(), ministryAttendanceTrend(id), listPeople(user)]);
  const tz = settings.timezone;
  const active = ministry.memberships.filter((m) => !m.endDate);
  const leaders = active.filter((m) => m.role === "leader");
  const past = ministry.memberships.filter((m) => m.endDate);
  const recent = trend.points.slice(-4);
  const avg = recent.length ? Math.round(recent.reduce((s, p) => s + p.present, 0) / recent.length) : 0;
  const rate = trend.memberCount ? Math.round((avg / trend.memberCount) * 100) : 0;
  const activeIds = new Set(active.map((m) => m.personId));

  return (
    <div data-tone={ministry.color}>
      <PageHeader
        eyebrow={<Link href="/ministerios" className="hover:text-foreground">Ministérios</Link>}
        title={<span className="inline-flex items-center gap-3"><span className="size-3 rounded-full bg-tone" />{ministry.name}{ministry.archived && <ToneBadge tone="slate">arquivado</ToneBadge>}</span>}
        description={ministry.description}
        actions={
          can.manageMinistries(user) && (
            <>
              <MinistryDialog initial={ministry} />
              <ArchiveButton id={ministry.id} archived={ministry.archived} icon={ministry.archived ? <ArchiveRestore /> : <Archive />} />
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Participantes" value={active.length} tone={ministry.color} hint={`${leaders.length} na liderança`} />
        <StatCard label="Presentes por semana" value={avg} tone={ministry.color} hint="média das últimas 4 semanas" />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Engajamento" value={`${rate}%`} tone={ministry.color} hint="dos participantes vêm toda semana" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Section
          title="Participantes"
          description={`${active.length} ativos`}
          action={!ministry.archived && <AddMembers ministryId={ministry.id} people={people.filter((p) => !activeIds.has(p.id) && p.status !== "inactive").map((p) => ({ id: p.id, name: displayName(p) }))} />}
        >
          <ul className="divide-y border-t">
            {[...leaders, ...active.filter((m) => m.role !== "leader")].map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                <PersonAvatar name={displayName(m.person)} seed={m.person.id} />
                <div className="min-w-0 flex-1">
                  <Link href={`/pessoas/${m.person.id}`} className="text-sm font-medium hover:underline">{displayName(m.person)}</Link>
                  <div className="text-xs text-muted-foreground">desde {formatDate(m.startDate, tz)}</div>
                </div>
                {m.role === "leader" && <ToneBadge tone="gold"><Crown className="size-3" /> Líder</ToneBadge>}
                <span className="hidden sm:inline"><StatusBadge status={m.person.status} /></span>
                <MembershipMenu id={m.id} role={m.role} />
              </li>
            ))}
            {active.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Ninguém neste ministério ainda.</li>}
          </ul>
        </Section>

        <div className="space-y-4">
          <Section title="Presença dos participantes" description="Pessoas únicas por semana">
            <div className="px-3 pb-3"><TrendChart data={trend.points} /></div>
          </Section>
          {past.length > 0 && (
            <Section title="Já participaram">
              <ul className="divide-y border-t">
                {past.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <Link href={`/pessoas/${m.person.id}`} className="truncate hover:underline">{displayName(m.person)}</Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(m.startDate, tz, { month: "short", year: "2-digit" })} – {formatDate(m.endDate, tz, { month: "short", year: "2-digit" })}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
