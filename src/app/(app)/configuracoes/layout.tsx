import { PageHeader } from "@/components/app/page-header";
import { requireRole } from "@/server/session";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return (
    <>
      <PageHeader title="Configurações" description="Dados da igreja, contas de acesso e registros de auditoria." />
      <SettingsNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
