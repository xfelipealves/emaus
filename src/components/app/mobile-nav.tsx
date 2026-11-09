"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { isActive, NAV } from "./nav-items";

export function MobileNav({ badges }: { badges: { followUps: number } }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const items = NAV.flatMap((g) => g.items).filter((i) => i.mobile);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                active && "text-primary",
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              {item.short ?? item.label}
              {item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                  {badges[item.badgeKey]}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" strokeWidth={1.8} />
          Mais
        </button>
      </div>
    </nav>
  );
}
