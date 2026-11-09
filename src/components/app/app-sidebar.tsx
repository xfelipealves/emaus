"use client";

import { ChevronsUpDown, KeyRound, LogOut, Monitor, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Role } from "@/db/schema";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABEL } from "@/lib/labels";
import { Logo } from "./logo";
import { isActive, NAV } from "./nav-items";
import { PersonAvatar } from "./tone";
import { openCommandMenu } from "./command-menu";

export type ShellUser = { id: string; name: string; role: Role; username: string | null };

export function AppSidebar({
  user,
  churchName,
  badges,
}: {
  user: ShellUser;
  churchName: string;
  badges: { followUps: number };
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="gap-3 px-3 pt-4">
        <Logo churchName={churchName} />
        <button
          type="button"
          onClick={() => {
            setOpenMobile(false);
            openCommandMenu();
          }}
          className="flex h-9 w-full items-center gap-2 rounded-lg border bg-background/60 px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-background"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || user.role === "admin");
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive(pathname, item.href)}
                        render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                        className="data-active:font-medium data-active:shadow-xs"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.badgeKey && badges[item.badgeKey] > 0 && (
                        <SidebarMenuBadge className="rounded-full bg-primary/12 text-primary">{badges[item.badgeKey]}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent" />
        }
      >
        <PersonAvatar name={user.name} seed={user.id} size="sm" />
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>@{user.username}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
            <DropdownMenuRadioItem value="light"><Sun /> Claro</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark"><Moon /> Escuro</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system"><Monitor /> Automático</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/conta")}>
          <KeyRound /> Minha conta
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await authClient.signOut();
            router.replace("/login");
            router.refresh();
          }}
        >
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
