"use client";

import { CalendarPlus, Moon, Sparkles, Sun, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { PersonStatus } from "@/db/schema";
import { STATUS_LABEL } from "@/lib/labels";
import { normalizeSearch } from "@/lib/text";
import { NAV } from "./nav-items";
import { PersonAvatar } from "./tone";

const EVENT = "emaus:command";

export function openCommandMenu() {
  window.dispatchEvent(new Event(EVENT));
}

export type CommandPerson = { id: string; name: string; status: PersonStatus };

export function CommandMenu({ people, isAdmin }: { people: CommandPerson[]; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Buscar"
      description="Pessoas, páginas e ações"
    >
      <Command>
      <CommandInput placeholder="Buscar ou perguntar ao assistente…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {search.trim().length > 3 && (
          <CommandGroup heading="Assistente">
            <CommandItem
              value={`assistente ${search}`}
              onSelect={() => {
                go(`/assistente?q=${encodeURIComponent(search.trim())}`);
                setSearch("");
              }}
            >
              <Sparkles /> Perguntar: “{search.trim()}”
            </CommandItem>
          </CommandGroup>
        )}
        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/pessoas?novo=1")}>
            <UserPlus /> Cadastrar pessoa
          </CommandItem>
          <CommandItem onSelect={() => go("/encontros?novo=1")}>
            <CalendarPlus /> Novo encontro
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />} Alternar tema
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Páginas">
          {NAV.flatMap((g) => g.items)
            .filter((i) => !i.adminOnly || isAdmin)
            .map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <item.icon /> {item.label}
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pessoas">
          {people.map((p) => (
            <CommandItem
              key={p.id}
              value={`${normalizeSearch(p.name)} ${p.id}`}
              onSelect={() => go(`/pessoas/${p.id}`)}
            >
              <PersonAvatar name={p.name} seed={p.id} size="xs" />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground">{STATUS_LABEL[p.status]}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
