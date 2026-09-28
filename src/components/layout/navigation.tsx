"use client";

import { CalendarBlank, CheckSquareOffset, GearSix, House, ListChecks, SquaresFour, UsersThree } from "@phosphor-icons/react";
import type { ElementType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: ElementType;
};

const primaryItems: NavigationItem[] = [
  { href: "/", label: "Início", shortLabel: "Início", icon: House },
  { href: "/pessoas", label: "Pessoas", shortLabel: "Pessoas", icon: UsersThree },
  { href: "/ministerios", label: "Ministérios", shortLabel: "Ministérios", icon: SquaresFour },
  { href: "/encontros", label: "Encontros", shortLabel: "Encontros", icon: CalendarBlank },
];

const settingsItem: NavigationItem = { href: "/configuracoes", label: "Configurações", shortLabel: "Mais", icon: GearSix };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function TopbarActions({ userName }: { userName: string }) {
  return (
    <div className="topbar__actions">
      <Link href="/atividades" aria-label="Atividades compartilhadas" title="Atividades compartilhadas" className="icon-button">
        <CheckSquareOffset size={20} weight="regular" aria-hidden="true" />
      </Link>
      <span aria-label={`Perfil de ${userName}`} role="img" className="profile-chip">{initials(userName)}</span>
    </div>
  );
}

function NavigationLink({
  href,
  label,
  icon,
  pathname,
  mobile = false,
}: NavigationItem & { pathname: string; mobile?: boolean }) {
  const active = isActive(pathname, href);
  const Icon = icon;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`nav-link ${active ? "nav-link--active" : ""}`}
      data-mobile={mobile ? "true" : undefined}
    >
      <span aria-hidden="true" className="nav-link__icon">
        <Icon size={mobile ? 20 : 19} weight={active ? "fill" : "regular"} />
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="desktop-nav">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">E</div>
        <div>
          <p className="brand-name">Emaús</p>
          <p className="brand-caption">Caminhar juntos, com cuidado.</p>
        </div>
      </div>
      <p className="nav-section-label">Espaço de trabalho</p>
      <div className="grid gap-1">
        {primaryItems.map((item) => (
          <NavigationLink key={item.href} {...item} pathname={pathname} />
        ))}
      </div>
      <div className="nav-footer">
        <p className="nav-footer__label">Acesso comunitário</p>
        <p className="nav-footer__value">Dados para cuidar melhor.</p>
        <div className="mt-3">
          <NavigationLink {...settingsItem} pathname={pathname} />
        </div>
      </div>
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação móvel" className="mobile-nav">
      {primaryItems.map((item) => (
        <NavigationLink key={item.href} {...item} label={item.shortLabel} pathname={pathname} mobile />
      ))}
      <NavigationLink {...settingsItem} label={settingsItem.shortLabel} pathname={pathname} mobile />
    </nav>
  );
}

export { ListChecks };
