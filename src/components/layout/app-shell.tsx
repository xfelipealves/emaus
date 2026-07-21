"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryNavigation = [
  { href: "/", label: "Início", shortLabel: "Início", marker: "01" },
  { href: "/pessoas", label: "Pessoas", shortLabel: "Pessoas", marker: "02" },
  { href: "/ministerios", label: "Ministérios", shortLabel: "Ministérios", marker: "03" },
  { href: "/encontros", label: "Encontros", shortLabel: "Encontros", marker: "04" },
];

const settingsNavigation = { href: "/configuracoes", label: "Configurações", marker: "05" };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function NavigationLink({ href, label, marker, pathname }: { href: string; label: string; marker: string; pathname: string }) {
  const active = isActive(pathname, href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
        active ? "bg-[#dcebe3] font-semibold text-[#184d3c]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
      href={href}
    >
      <span className={`grid size-7 place-items-center rounded-lg text-[11px] font-semibold ${active ? "bg-[#184d3c] text-white" : "bg-slate-200 text-slate-500 group-hover:bg-white"}`}>
        {marker}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200/80 bg-white/90 px-5 py-6 md:flex md:flex-col">
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-2xl bg-[#184d3c] text-lg font-semibold text-white">E</div>
          <div>
            <p className="font-semibold tracking-tight">Emaús</p>
            <p className="text-xs text-slate-500">Vida comunitária</p>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="space-y-1">
          {primaryNavigation.map((item) => <NavigationLink key={item.href} {...item} pathname={pathname} />)}
        </nav>

        <div className="mt-auto border-t border-slate-100 pt-5">
          <NavigationLink {...settingsNavigation} pathname={pathname} />
          <div className="mt-5 rounded-2xl bg-[#f0f4ef] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#477462]">Espaço local</p>
            <p className="mt-2 text-sm leading-5 text-slate-600">Acompanhe a comunidade com calma e clareza.</p>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur md:px-10">
          <div className="flex items-center gap-3 md:hidden">
            <div className="grid size-8 place-items-center rounded-xl bg-[#184d3c] text-sm font-semibold text-white">E</div>
            <span className="font-semibold">Emaús</span>
          </div>
          <p className="hidden text-sm text-slate-500 md:block">Comunidade em movimento</p>
          <div className="flex items-center gap-3" aria-label="Conta atual">
            <span className="hidden text-right text-sm md:block"><strong className="block font-medium">Equipe Emaús</strong><span className="text-xs text-slate-500">Administrador</span></span>
            <span className="grid size-9 place-items-center rounded-full bg-[#dcebe3] text-sm font-semibold text-[#184d3c]">EE</span>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-5 pb-28 pt-8 md:px-10 md:pb-10 md:pt-10">{children}</main>
      </div>

      <nav aria-label="Navegação mobile" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        {primaryNavigation.map((item) => {
          const active = isActive(pathname, item.href);
          return <Link key={item.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] ${active ? "font-semibold text-[#184d3c]" : "text-slate-500"}`} href={item.href}><span className="text-[10px]">{item.marker}</span><span>{item.shortLabel}</span></Link>;
        })}
        <Link aria-label="Mais opções" className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] ${isActive(pathname, settingsNavigation.href) ? "font-semibold text-[#184d3c]" : "text-slate-500"}`} href={settingsNavigation.href}><span className="text-[10px]">•••</span><span>Mais</span></Link>
      </nav>
    </div>
  );
}
