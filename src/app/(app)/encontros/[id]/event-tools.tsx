"use client";

import { Ban, Copy, MoreHorizontal, QrCode, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useAction } from "@/hooks/use-action";
import { cancelEventAction, deleteEventAction, setCheckinOpenAction } from "../actions";

export function QrDialog({ eventId, url, svg, open: isOpen, canManage }: { eventId: string; url: string; svg: string; open: boolean; canManage: boolean }) {
  const [dialog, setDialog] = useState(false);
  const toggle = useAction(setCheckinOpenAction);
  return (
    <>
      <Button variant="outline" onClick={() => setDialog(true)}>
        <QrCode data-icon="inline-start" /> QR Code
        {isOpen && <span className="ml-1 size-2 animate-pulse rounded-full bg-success" />}
      </Button>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check-in por QR Code</DialogTitle>
            <DialogDescription>
              Projete no telão ou imprima. Quem já tem cadastro confirma pelo celular; visitantes se cadastram em segundos.
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto w-full max-w-64 rounded-2xl bg-white p-4 shadow-inner [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
            <Button variant="ghost" size="icon-xs" aria-label="Copiar link" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}><Copy /></Button>
          </div>
          {canManage && (
            <label className="flex items-center justify-between gap-4 rounded-xl border p-3">
              <div>
                <div className="text-sm font-medium">{isOpen ? "Check-in aberto" : "Check-in fechado"}</div>
                <div className="text-xs text-muted-foreground">Só aceita registros enquanto estiver aberto.</div>
              </div>
              <Switch checked={isOpen} disabled={toggle.pending} onCheckedChange={(v) => toggle.run(eventId, v)} />
            </label>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EventMenu({ eventId, cancelled, inSeries }: { eventId: string; cancelled: boolean; inSeries: boolean }) {
  const [confirm, setConfirm] = useState<null | "one" | "future">(null);
  const cancel = useAction(cancelEventAction);
  const del = useAction(deleteEventAction);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Mais ações" />}><MoreHorizontal /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={() => cancel.run(eventId, !cancelled)}>
            {cancelled ? <><RotateCcw /> Reativar encontro</> : <><Ban /> Cancelar este encontro</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirm("one")}><Trash2 /> Excluir este encontro</DropdownMenuItem>
          {inSeries && <DropdownMenuItem variant="destructive" onClick={() => setConfirm("future")}><Trash2 /> Excluir este e os próximos</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "future" ? "Excluir este e os próximos encontros?" : "Excluir este encontro?"}</AlertDialogTitle>
            <AlertDialogDescription>
              As presenças lançadas {confirm === "future" ? "nesses encontros" : "neste encontro"} também serão apagadas. Se ele só não vai acontecer, prefira cancelar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={del.pending} onClick={() => confirm && del.run(eventId, confirm)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
