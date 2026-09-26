import { DesktopNavigation, MobileNavigation } from "./navigation";
import Link from "next/link";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#f7f9f8] text-slate-950">
      <div className="flex min-h-screen">
        <DesktopNavigation />
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-slate-200/80 bg-[#f7f9f8] px-5 py-5 sm:px-8 lg:px-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 lg:hidden">Emaús</p>
              <p className="mt-1 text-sm text-slate-500">Sábado, 08 de agosto</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/atividades" aria-label="Atividades compartilhadas" title="Atividades compartilhadas" className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-900">✓</Link>
              <button type="button" aria-label="Notificações" className="rounded-full p-2 text-slate-500 hover:bg-white hover:text-slate-900">
                ◌
              </button>
              <div aria-label="Perfil de Ana Souza" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1d6b8] text-xs font-bold text-[#754b2b]">
                AS
              </div>
            </div>
          </header>
          <main className="px-5 pb-28 pt-8 sm:px-8 lg:px-12 lg:pb-12">{children}</main>
        </div>
      </div>
      <MobileNavigation />
    </div>
  );
}
