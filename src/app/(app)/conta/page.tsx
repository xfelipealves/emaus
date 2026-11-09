import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/app/page-header";
import { ToneBadge, ToneDot } from "@/components/app/tone";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { ROLE_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/session";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ "primeiro-acesso"?: string }> }) {
  const user = await requireUser();
  const firstAccess = user.mustChangePassword || (await searchParams)["primeiro-acesso"] === "1";
  const ministries = user.ministryIds?.length
    ? await db.select().from(schema.ministry).where(inArray(schema.ministry.id, user.ministryIds))
    : [];

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso ao Emaús." />
      {user.mustChangePassword && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold" />
          <div>
            <div className="font-medium">Defina sua senha para continuar</div>
            <p className="text-muted-foreground">
              O Emaús guarda dados pastorais da igreja. A senha que você recebeu é provisória — escolha uma só sua.
            </p>
          </div>
        </div>
      )}
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <Section title="Acesso">
          <dl className="space-y-3 px-5 pb-5 text-sm">
            <div><dt className="text-xs text-muted-foreground">Nome</dt><dd>{user.name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Usuário</dt><dd>@{user.username}</dd></div>
            <div><dt className="text-xs text-muted-foreground">E-mail</dt><dd>{user.email}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Papel</dt><dd><ToneBadge tone="ember">{ROLE_LABEL[user.role]}</ToneBadge></dd></div>
            {user.role === "leader" && (
              <div>
                <dt className="text-xs text-muted-foreground">Ministérios que você acompanha</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {ministries.length ? ministries.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5"><ToneDot tone={m.color} />{m.name}</span>) : "Nenhum — fale com um administrador."}
                </dd>
              </div>
            )}
          </dl>
        </Section>
        <Section title={firstAccess ? "Nova senha" : "Trocar senha"} description="Ao trocar, seus outros dispositivos são desconectados.">
          <div className="px-5 pb-5"><PasswordForm firstAccess={user.mustChangePassword} /></div>
        </Section>
      </div>
    </>
  );
}
