import {
  CalendarDays,
  HeartHandshake,
  House,
  type LucideIcon,
  Network,
  Settings,
  Sparkles,
  Users,
  UsersRound,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  badgeKey?: "followUps";
  mobile?: boolean;
};

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Comunidade",
    items: [
      { href: "/", label: "Início", icon: House, mobile: true },
      { href: "/pessoas", label: "Pessoas", icon: Users, mobile: true },
      { href: "/familias", label: "Famílias", icon: UsersRound },
      { href: "/ministerios", label: "Ministérios", icon: Network },
    ],
  },
  {
    label: "Rotina",
    items: [
      { href: "/encontros", label: "Encontros", icon: CalendarDays, mobile: true },
      { href: "/cuidado", label: "Cuidado pastoral", short: "Cuidado", icon: HeartHandshake, badgeKey: "followUps", mobile: true },
      { href: "/assistente", label: "Assistente", icon: Sparkles },
    ],
  },
  {
    label: "Administração",
    items: [{ href: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true }],
  },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
