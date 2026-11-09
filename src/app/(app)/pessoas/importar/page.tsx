import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { can, requireUser } from "@/server/session";
import { Importer } from "./importer";

export const metadata: Metadata = { title: "Importar pessoas" };

export default async function ImportPage() {
  const user = await requireUser();
  if (!can.importPeople(user)) redirect("/pessoas");
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/pessoas" className="hover:text-foreground">Pessoas</Link>}
        title="Importar planilha"
        description="Traga a lista que hoje vive no Excel ou Google Sheets. Exporte como CSV e envie aqui — nós reconhecemos as colunas."
      />
      <Importer />
    </>
  );
}
