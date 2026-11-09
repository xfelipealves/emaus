import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PersonAvatar } from "@/components/app/tone";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { HOUSEHOLD_ROLE_LABEL } from "@/lib/labels";
import { displayName } from "@/lib/text";
import { listHouseholds } from "@/server/households";
import { requireUser } from "@/server/session";
import { HouseholdDialog } from "./household-dialog";

export const metadata: Metadata = { title: "Famílias" };

const ORDER = ["head", "spouse", "child", "other"];

export default async function HouseholdsPage() {
  const user = await requireUser();
  const households = await listHouseholds(user);

  return (
    <>
      <PageHeader
        title="Famílias"
        description="Casas e núcleos familiares. Ajuda a cuidar de todos de uma vez e a lembrar das crianças."
        actions={user.role !== "leader" && <HouseholdDialog />}
      />
      {households.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyTitle>Nenhuma família ainda</EmptyTitle>
            <EmptyDescription>Crie uma família e vincule as pessoas pelo perfil de cada uma.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {households.map((h) => {
            const members = [...h.members].sort((a, b) => ORDER.indexOf(a.householdRole ?? "other") - ORDER.indexOf(b.householdRole ?? "other"));
            const adults = members.filter((m) => m.householdRole === "head" || m.householdRole === "spouse");
            const kids = members.filter((m) => m.householdRole === "child").length;
            return (
              <Link
                key={h.id}
                href={`/familias/${h.id}`}
                className="group rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((m) => (
                    <PersonAvatar key={m.id} name={displayName(m)} seed={m.id} size="md" className="ring-2 ring-card" />
                  ))}
                  {members.length > 5 && (
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-card">+{members.length - 5}</span>
                  )}
                </div>
                <h2 className="mt-4 font-display text-2xl leading-tight group-hover:text-primary">{h.name}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {adults.length ? adults.map((a) => displayName(a).split(" ")[0]).join(" & ") : members.length ? `${members.length} pessoas` : "Sem membros"}
                  {kids > 0 && ` · ${kids} ${kids === 1 ? "filho(a)" : "filhos"}`}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {members.length} {members.length === 1 ? "pessoa" : "pessoas"}
                  {h.address && ` · ${h.address}`}
                </p>
                <span className="sr-only">{members.map((m) => `${displayName(m)} (${HOUSEHOLD_ROLE_LABEL[m.householdRole ?? "other"]})`).join(", ")}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
