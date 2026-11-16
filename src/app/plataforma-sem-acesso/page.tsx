import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app/logo";
import { SignOutButton } from "@/app/plataforma/forms";
import { getAccount } from "@/server/session";

export const metadata: Metadata = { title: "Plataforma" };

/** Quem abre /plataforma com a conta de uma igreja: diz o porquê e oferece trocar de conta. */
export default async function PlatformNoAccessPage() {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.platformAdmin) redirect("/plataforma");
  return (
    <main className="paper flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-xs">
        <LogoMark className="size-10" />
        <h1 className="font-display text-3xl">Painel da plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Você está conectado como <strong className="text-foreground">{account.name}</strong>
          {account.username ? ` (@${account.username})` : ""}, uma conta de igreja. O painel da plataforma é só para a conta de
          operador do Emaús.
        </p>
        <p className="text-sm text-muted-foreground">Saia e entre com a conta de operador para ver as igrejas e a IA de todas elas.</p>
        <div className="flex gap-2">
          <SignOutButton />
          <Link href="/" className="inline-flex items-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground">
            Voltar ao app
          </Link>
        </div>
      </div>
    </main>
  );
}
