import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonAvatar, ToneBadge } from "@/components/app/tone";
import { FollowUpItem, NewFollowUpButton } from "@/components/people/follow-ups";
import { Button } from "@/components/ui/button";
import { formatDaysAgo, todayIso } from "@/lib/dates";
import { displayName } from "@/lib/text";
import { listAssignees, listFollowUps } from "@/server/care";
import { listPeople, peopleNeedingCare } from "@/server/people";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { QuickFollowUp } from "./quick-follow-up";

export const metadata: Metadata = { title: "Cuidado pastoral" };

export default async function CarePage({ searchParams }: { searchParams: Promise<{ quem?: string }> }) {
  const user = await requireUser();
  const { quem } = await searchParams;
  const [settings, open, done, care, assignees, people] = await Promise.all([
    getSettings(),
    listFollowUps(user, { assigneeId: quem === "todos" ? undefined : user.id }),
    listFollowUps(user, { done: true }),
    peopleNeedingCare(user),
    listAssignees(),
    listPeople(user),
  ]);
  const today = todayIso(settings.timezone);
  const overdue = open.filter((f) => f.dueDate && f.dueDate < today);
  const rest = open.filter((f) => !(f.dueDate && f.dueDate < today));

  return (
    <>
      <PageHeader
        title="Cuidado pastoral"
        description="Ninguém caminha sozinho. Acompanhe quem sumiu, quem chegou e quem precisa de uma palavra."
        actions={
          <NewFollowUpButton
            variant="default"
            label="Novo acompanhamento"
            people={people.filter((p) => p.status !== "inactive").map((p) => ({ id: p.id, name: displayName(p) }))}
            assignees={assignees}
            currentUserId={user.id}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Section
            title="Acompanhamentos"
            description={`${open.length} em aberto${overdue.length ? ` · ${overdue.length} atrasados` : ""}`}
            action={
              <div className="flex rounded-lg border p-0.5">
                <Button variant={quem !== "todos" ? "secondary" : "ghost"} size="xs" render={<Link href="/cuidado" />} nativeButton={false}>Meus</Button>
                <Button variant={quem === "todos" ? "secondary" : "ghost"} size="xs" render={<Link href="/cuidado?quem=todos" />} nativeButton={false}>Todos</Button>
              </div>
            }
          >
            {open.length ? (
              <ul className="divide-y border-t">
                {[...overdue, ...rest].map((f) => <FollowUpItem key={f.id} item={f} today={today} showPerson />)}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 border-t px-5 py-10 text-center">
                <HeartHandshake className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhum acompanhamento pendente. Veja ao lado quem pode precisar de um contato.</p>
              </div>
            )}
          </Section>
          {done.length > 0 && (
            <Section title="Concluídos recentemente">
              <ul className="divide-y border-t">{done.slice(0, 10).map((f) => <FollowUpItem key={f.id} item={f} today={today} showPerson />)}</ul>
            </Section>
          )}
        </div>

        <Section title="Sumiram por um tempo" description={`Sem presença há ${settings.careThresholdDays} dias ou mais · ${care.length} pessoas`}>
          <ul className="divide-y border-t">
            {care.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <PersonAvatar name={displayName(p)} seed={p.id} />
                <div className="min-w-0 flex-1">
                  <Link href={`/pessoas/${p.id}`} className="block truncate text-sm font-medium hover:underline">{displayName(p)}</Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={p.status} />
                    {p.neverSeen ? "sem presença registrada" : formatDaysAgo(p.absentDays)}
                  </div>
                </div>
                {p.hasFollowUp ? (
                  <ToneBadge tone="sage">em contato</ToneBadge>
                ) : (
                  <QuickFollowUp personId={p.id} name={displayName(p)} />
                )}
              </li>
            ))}
            {care.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Todos têm aparecido. 🙌</li>}
          </ul>
        </Section>
      </div>
    </>
  );
}
