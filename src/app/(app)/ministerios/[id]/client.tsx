"use client";

import { Check, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { PersonAvatar } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { normalizeSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import { addMembersAction, archiveMinistryAction } from "../actions";

export function AddMembers({ ministryId, people }: { ministryId: string; people: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const add = useAction(addMembersAction, {
    onSuccess: () => {
      setOpen(false);
      setSelected(new Set());
      setQ("");
    },
  });
  const list = useMemo(() => {
    const n = normalizeSearch(q);
    return n ? people.filter((p) => normalizeSearch(p.name).includes(n)) : people;
  }, [q, people]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><UserPlus data-icon="inline-start" /> Adicionar</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar participantes</DialogTitle>
            <DialogDescription>Selecione uma ou mais pessoas.</DialogDescription>
          </DialogHeader>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" autoFocus />
          <ul className="-mx-2 max-h-80 overflow-y-auto">
            {list.map((p) => {
              const on = selected.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected((s) => { const n = new Set(s); if (on) n.delete(p.id); else n.add(p.id); return n; })}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted", on && "bg-primary/8")}
                  >
                    <PersonAvatar name={p.name} seed={p.id} size="xs" />
                    <span className="flex-1">{p.name}</span>
                    <span className={cn("flex size-5 items-center justify-center rounded-md border", on && "border-primary bg-primary text-primary-foreground")}>
                      {on && <Check className="size-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button disabled={!selected.size || add.pending} onClick={() => add.run(ministryId, [...selected])}>
              {add.pending ? <Spinner /> : `Adicionar ${selected.size || ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ArchiveButton({ id, archived, icon }: { id: string; archived: boolean; icon: React.ReactNode }) {
  const run = useAction(archiveMinistryAction);
  return (
    <Button variant="ghost" disabled={run.pending} onClick={() => run.run(id, !archived)}>
      {icon} {archived ? "Reativar" : "Arquivar"}
    </Button>
  );
}
