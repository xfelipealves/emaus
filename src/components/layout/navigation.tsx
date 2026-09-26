"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryItems = [
  { href: "/", label: "Início", shortLabel: "Início", icon: "⌂" },
  { href: "/pessoas", label: "Pessoas", shortLabel: "Pessoas", icon: "○" },
  { href: "/ministerios", label: "Ministérios", shortLabel: "Ministérios", icon: "✦" },
  { href: "/encontros", label: "Encontros", shortLabel: "Encontros", icon: "◷" },
];

const settingsItem = { href: "/configuracoes", label: "Configurações", shortLabel: "Mais", icon: "⋯" };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function NavigationLink({
  href,
  label,
  icon,
  pathname,
  mobile = false,
}: {
  href: string;
  label: string;
  icon: string;
  pathname: string;
  mobile?: boolean;
}) {
  const active = isActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl transition-colors ${
        mobile ? "min-w-16 flex-col gap-1 px-2 py-2 text-[11px]" : "px-3 py-2.5 text-sm"
      } ${active ? "bg-[#dceee9] font-semibold text-[#155e58]" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
    >
      <span aria-hidden="true" className={mobile ? "text-lg leading-none" : "text-base leading-none"}>
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
      <div className="mb-12 px-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#26766d]">Emaús</p>
        <p className="mt-2 text-sm text-slate-500">Vida comunitária, com cuidado.</p>
      </div>
      <div className="space-y-1">
        {primaryItems.map((item) => (
          <NavigationLink key={item.href} {...item} pathname={pathname} />
        ))}
      </div>
      <div className="mt-auto border-t border-slate-100 pt-4">
        <NavigationLink {...settingsItem} pathname={pathname} />
      </div>
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden">
      {primaryItems.map((item) => (
        <NavigationLink key={item.href} href={item.href} label={item.shortLabel} icon={item.icon} pathname={pathname} mobile />
      ))}
      <NavigationLink {...settingsItem} label={settingsItem.shortLabel} pathname={pathname} mobile />
    </nav>
  );
}
