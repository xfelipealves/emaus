import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/app/page-header";
import { requirePlatformAdmin } from "@/server/session";
import { PasswordForm } from "../../(app)/conta/password-form";
import { changeOperatorPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Minha conta" };

export default async function OperatorAccountPage() {
  const account = await requirePlatformAdmin({ pendingPassword: true });
  return (
    <>
      <PageHeader title="Minha conta" description="Acesso de operação da plataforma." />
      {account.mustChangePassword && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold" />
          <div>
            <div className="font-medium">Defina sua senha para continuar</div>
            <p className="text-muted-foreground">
              Esta conta controla todas as igrejas. A senha que você recebeu é provisória — escolha uma só sua.
            </p>
          </div>
        </div>
      )}
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <Section title="Acesso">
          <dl className="space-y-3 px-5 pb-5 text-sm">
            <div><dt className="text-xs text-muted-foreground">Nome</dt><dd>{account.name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Usuário</dt><dd>@{account.username}</dd></div>
            <div><dt className="text-xs text-muted-foreground">E-mail</dt><dd>{account.email}</dd></div>
          </dl>
        </Section>
        <Section title={account.mustChangePassword ? "Nova senha" : "Trocar senha"} description="Ao trocar, seus outros dispositivos são desconectados.">
          <div className="px-5 pb-5">
            <PasswordForm firstAccess={account.mustChangePassword} action={changeOperatorPasswordAction} home="/plataforma" />
          </div>
        </Section>
      </div>
    </>
  );
}
