import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app/logo";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const settings = await getSettings();

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <aside className="paper relative hidden flex-col justify-between overflow-hidden border-r bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <div className="font-display text-2xl leading-none">Emaús</div>
            <div className="mt-1 text-xs text-muted-foreground">{settings.name}</div>
          </div>
        </div>
        <Road />
        <blockquote className="relative max-w-md space-y-3">
          <p className="font-display text-4xl leading-tight text-balance">
            “Fica conosco, porque é tarde, e já declinou o dia.”
          </p>
          <footer className="text-sm text-muted-foreground">Lucas 24:29</footer>
        </blockquote>
      </aside>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark className="size-10" />
            <div className="font-display text-2xl">Emaús</div>
          </div>
          <h1 className="font-display text-4xl">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre para acompanhar a caminhada da sua comunidade.
          </p>
          <LoginForm />
          {isDemoMode() && (
            <div className="mt-6 rounded-xl border bg-muted/50 p-4 text-sm">
              <p className="font-medium">Demonstração pública</p>
              <p className="mt-1 text-muted-foreground">Entre com usuário <strong>admin</strong> e senha <strong>admin</strong>. Os dados são fictícios e compartilhados. Não cadastre informações pessoais reais.</p>
            </div>
          )}
          {!isDemoMode() && (
            <p className="mt-8 text-xs text-muted-foreground">
              Esqueceu a senha? Peça a um administrador para redefini-la em Configurações → Usuários.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

/** Ilustração: estrada que some no horizonte ao pôr do sol. */
function Road() {
  return (
    <svg viewBox="0 0 400 260" className="pointer-events-none absolute inset-x-0 top-1/2 w-full -translate-y-1/2 opacity-90" aria-hidden>
      <defs>
        <linearGradient id="sun" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--c-gold)" />
          <stop offset="1" stopColor="var(--c-ember)" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="120" r="54" fill="url(#sun)" opacity="0.55" />
      <path d="M0 150 Q100 130 200 140 T400 135 L400 260 L0 260Z" fill="var(--c-sage)" opacity="0.18" />
      <path d="M0 175 Q120 155 220 168 T400 160 L400 260 L0 260Z" fill="var(--c-ember)" opacity="0.12" />
      <path d="M196 142 C190 180 150 220 90 260 L310 260 C250 220 210 180 204 142Z" fill="var(--foreground)" opacity="0.06" />
      <path d="M200 146 C199 175 190 215 180 260" stroke="var(--background)" strokeWidth="2" strokeDasharray="6 10" opacity="0.7" fill="none" />
    </svg>
  );
}
