"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/configuracoes", label: "Igreja" },
  { href: "/configuracoes/usuarios", label: "Usuários e acessos" },
  { href: "/configuracoes/categorias", label: "Categorias de encontro" },
  { href: "/configuracoes/auditoria", label: "Auditoria" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b scrollbar-none">
      {ITEMS.map((i) => {
        const active = pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
