"use client";

import { MoreHorizontal, Trash2, UserMinus, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { FormField } from "@/components/app/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { HouseholdRole } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { HOUSEHOLD_ROLE_LABEL } from "@/lib/labels";
import { normalizeSearch } from "@/lib/text";
import { deleteHouseholdAction, setMemberAction } from "../actions";

const ROLES = ["head", "spouse", "child", "other"] as const;

export function AddHouseholdMember({ householdId, people }: { householdId: string; people: { id: string; name: string; household: string | null }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<HouseholdRole>("child");
  const add = useAction(setMemberAction);
  const results = useMemo(() => {
    const n = normalizeSearch(q);
    return n ? people.filter((p) => normalizeSearch(p.name).includes(n)).slice(0, 8) : [];
  }, [q, people]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><UserPlus data-icon="inline-start" /> Adicionar</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar à família</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
            <FormField label="Buscar pessoa" htmlFor="hm-q">
              <Input id="hm-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite o nome" autoFocus />
            </FormField>
            <FormField label="Papel" htmlFor="hm-role">
              <NativeSelect id="hm-role" value={role} onChange={(e) => setRole(e.target.value as HouseholdRole)}>
                {ROLES.map((r) => <option key={r} value={r}>{HOUSEHOLD_ROLE_LABEL[r]}</option>)}
              </NativeSelect>
            </FormField>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={add.pending}
                  onClick={async () => {
                    const r = await add.run(householdId, p.id, role);
                    if (r.ok) setQ("");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium">{p.name}</span>
                  {p.household && <span className="text-xs text-muted-foreground">sai de {p.household}</span>}
                </button>
              </li>
            ))}
            {q && results.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Ninguém encontrado. Cadastre a pessoa primeiro.</li>}
          </ul>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function HouseholdMemberMenu({ householdId, personId, role }: { householdId: string; personId: string; role: HouseholdRole }) {
  const set = useAction(setMemberAction);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ações" />}><MoreHorizontal /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Papel na família</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={role} onValueChange={(v) => set.run(householdId, personId, v as HouseholdRole)}>
            {ROLES.map((r) => <DropdownMenuRadioItem key={r} value={r}>{HOUSEHOLD_ROLE_LABEL[r]}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => set.run(householdId, personId, null)}><UserMinus /> Remover da família</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DeleteHousehold({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const del = useAction(deleteHouseholdAction);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Excluir família" onClick={() => setOpen(true)}><Trash2 /></Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {name}?</AlertDialogTitle>
            <AlertDialogDescription>As pessoas continuam cadastradas, apenas ficam sem família vinculada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => del.run(id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
