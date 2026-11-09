"use client";

import { ArrowRightLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { PersonSheet } from "./person-sheet";
import type { PersonFormValues } from "./person-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { PersonStatus } from "@/db/schema";
import { useAction } from "@/hooks/use-action";
import { STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { changeStatusAction, deletePersonAction } from "@/app/(app)/pessoas/actions";

export function PersonActions({
  person,
  households,
  canDelete,
}: {
  person: PersonFormValues & { id: string; fullName: string; status: PersonStatus };
  households: { id: string; name: string }[];
  canDelete: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [target, setTarget] = useState<PersonStatus>(person.status === "member" ? "inactive" : "member");
  const [reason, setReason] = useState("");
  const status = useAction(changeStatusAction, { onSuccess: () => setStatusOpen(false) });
  const remove = useAction(deletePersonAction);

  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil data-icon="inline-start" /> Editar
      </Button>
      <Button variant="outline" onClick={() => setStatusOpen(true)}>
        <ArrowRightLeft data-icon="inline-start" /> Status
      </Button>
      {canDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Mais ações" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}><Pencil /> Editar cadastro</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Excluir cadastro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <PersonSheet open={editOpen} onOpenChange={setEditOpen} initial={person} households={households} />

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mudar status</DialogTitle>
            <DialogDescription>
              O histórico de {person.fullName.split(" ")[0]} é preservado. A mudança fica registrada na linha do tempo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(["visitor", "member", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={s === person.status}
                onClick={() => setTarget(s)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-sm font-medium transition-colors disabled:opacity-40",
                  target === s && s !== person.status ? "border-primary bg-primary/8 text-primary" : "hover:bg-muted",
                )}
              >
                {STATUS_LABEL[s]}
                {s === person.status && <div className="text-xs font-normal text-muted-foreground">atual</div>}
              </button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional) — ex.: batismo, mudou de cidade…" rows={2} />
          <DialogFooter>
            <Button
              disabled={status.pending || target === person.status}
              onClick={() => status.run(person.id, target, reason || undefined)}
            >
              {status.pending ? <Spinner /> : `Tornar ${STATUS_LABEL[target].toLowerCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {person.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga o cadastro, presenças, anotações e histórico. Para quem só se afastou, prefira marcar como inativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={remove.pending} onClick={() => remove.run(person.id)}>
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
