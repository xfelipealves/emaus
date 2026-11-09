import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { listHouseholds } from "@/server/households";
import { listMinistries } from "@/server/ministries";
import { listPeople } from "@/server/people";
import { can, requireUser } from "@/server/session";
import { PeopleBrowser } from "./people-browser";

export const metadata: Metadata = { title: "Pessoas" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ novo?: string; status?: string; ministerio?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [people, ministries, households] = await Promise.all([
    listPeople(user),
    listMinistries(user),
    listHouseholds(user),
  ]);

  return (
    <>
      <PageHeader
        title="Pessoas"
        description="Todos que caminham com a comunidade: membros, visitantes e quem se afastou."
      />
      <PeopleBrowser
        people={people.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          preferredName: p.preferredName,
          status: p.status,
          phone: p.phone,
          age: p.age,
          householdName: p.householdName,
          daysSinceSeen: p.daysSinceSeen,
          visits: p.visits,
          ministries: p.ministries,
        }))}
        ministries={ministries.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
        households={households.map((h) => ({ id: h.id, name: h.name }))}
        canImport={can.importPeople(user)}
        openNew={params.novo === "1"}
        initialStatus={params.status}
        initialMinistry={params.ministerio}
      />
    </>
  );
}
