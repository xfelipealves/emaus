import { Crown, Network } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PersonAvatar } from "@/components/app/tone";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { displayName } from "@/lib/text";
import { listMinistries } from "@/server/ministries";
import { can, requireUser } from "@/server/session";
import { MinistryDialog } from "./ministry-dialog";

export const metadata: Metadata = { title: "Ministérios" };

export default async function MinistriesPage() {
  const user = await requireUser();
  const ministries = await listMinistries(user, { includeArchived: true });
  const active = ministries.filter((m) => !m.archived);
  const archived = ministries.filter((m) => m.archived);

  return (
    <>
      <PageHeader
        title="Ministérios"
        description={user.ministryIds ? "Ministérios que você acompanha." : "Quem serve onde, e quem lidera cada frente."}
        actions={can.manageMinistries(user) && <MinistryDialog />}
      />
      {active.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Network /></EmptyMedia>
            <EmptyTitle>Nenhum ministério</EmptyTitle>
            <EmptyDescription>{user.ministryIds ? "Peça a um administrador para liberar seu acesso." : "Crie o primeiro ministério da igreja."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((m) => (
            <Link
              key={m.id}
              href={`/ministerios/${m.id}`}
              data-tone={m.color}
              className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-tone" />
              <div className="flex items-start justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-tone/12 text-tone"><Network className="size-5" /></span>
                <span className="font-display text-3xl leading-none tabular">{m.memberCount}</span>
              </div>
              <h2 className="mt-4 font-display text-2xl leading-tight">{m.name}</h2>
              {m.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                {m.leaders.length ? (
                  <>
                    <div className="flex -space-x-1.5">
                      {m.leaders.slice(0, 3).map((l) => <PersonAvatar key={l.id} name={displayName(l)} seed={l.id} size="xs" className="ring-2 ring-card" />)}
                    </div>
                    <Crown className="size-3 text-gold" />
                    <span className="truncate">{m.leaders.map((l) => displayName(l).split(" ")[0]).join(", ")}</span>
                  </>
                ) : (
                  <span>Sem líder definido</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Arquivados</h2>
          <div className="flex flex-wrap gap-2">
            {archived.map((m) => (
              <Link key={m.id} href={`/ministerios/${m.id}`} className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-muted">{m.name}</Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
