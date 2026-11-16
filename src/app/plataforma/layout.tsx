import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/app/logo";
import { requirePlatformAdmin } from "@/server/session";
import { SignOutButton } from "./forms";
import { PlatformNav } from "./nav";

export const metadata: Metadata = { title: { default: "Plataforma", template: "%s · Plataforma Emaús" } };

/** Painel de quem opera o Emaús: todas as igrejas, sem acesso aos dados pastorais delas. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const account = await requirePlatformAdmin();
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-sidebar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/plataforma" className="flex items-center gap-2.5">
            <LogoMark className="size-8" />
            <span className="font-display text-xl leading-none">Plataforma</span>
          </Link>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="hidden sm:inline">{account.name}</span>
            {account.churchId && (
              <Link href="/" className="rounded-md px-2 py-1 hover:text-foreground">
                Minha igreja
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
          <PlatformNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
