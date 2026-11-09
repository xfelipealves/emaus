import { MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { PersonAvatar } from "@/components/app/tone";
import { ageFrom, todayIso } from "@/lib/dates";
import { HOUSEHOLD_ROLE_LABEL } from "@/lib/labels";
import { displayName, formatPhone } from "@/lib/text";
import { getHousehold } from "@/server/households";
import { listPeople } from "@/server/people";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { HouseholdDialog } from "../household-dialog";
import { AddHouseholdMember, HouseholdMemberMenu, DeleteHousehold } from "./members";

export const metadata: Metadata = { title: "Família" };

const ORDER = ["head", "spouse", "child", "other"];

export default async function HouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const house = await getHousehold(user, id);
  if (!house) notFound();
  const [settings, people] = await Promise.all([getSettings(), listPeople(user)]);
  const today = todayIso(settings.timezone);
  const members = [...house.members].sort((a, b) => ORDER.indexOf(a.householdRole ?? "other") - ORDER.indexOf(b.householdRole ?? "other"));
  const canEdit = user.role !== "leader";

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/familias" className="hover:text-foreground">Famílias</Link>}
        title={house.name}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {house.address && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {house.address}</span>}
            {house.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" /> {formatPhone(house.phone)}</span>}
          </span>
        }
        actions={
          canEdit && (
            <>
              <HouseholdDialog initial={house} />
              <DeleteHousehold id={house.id} name={house.name} />
            </>
          )
        }
      />
      <Section
        title="Membros da casa"
        description={`${members.length} ${members.length === 1 ? "pessoa" : "pessoas"}`}
        action={
          <AddHouseholdMember
            householdId={house.id}
            people={people.filter((p) => p.householdId !== house.id).map((p) => ({ id: p.id, name: displayName(p), household: p.householdName }))}
          />
        }
      >
        <ul className="divide-y border-t">
          {members.map((m) => {
            const age = ageFrom(m.birthDate, today);
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <PersonAvatar name={displayName(m)} seed={m.id} size="md" />
                <div className="min-w-0 flex-1">
                  <Link href={`/pessoas/${m.id}`} className="font-medium hover:underline">{displayName(m)}</Link>
                  <div className="text-xs text-muted-foreground">
                    {HOUSEHOLD_ROLE_LABEL[m.householdRole ?? "other"]}
                    {age !== null && ` · ${age} anos`}
                    {m.phone && ` · ${formatPhone(m.phone)}`}
                  </div>
                </div>
                <StatusBadge status={m.status} />
                <HouseholdMemberMenu householdId={house.id} personId={m.id} role={m.householdRole ?? "other"} />
              </li>
            );
          })}
          {members.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Adicione as pessoas desta casa.</li>}
        </ul>
      </Section>
    </>
  );
}
