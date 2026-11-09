"use client";

import { Crown, LogOut, MoreHorizontal, Plus, UserRound } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { addToMinistryAction, endMembershipAction, setMembershipRoleAction } from "@/app/(app)/pessoas/actions";

export function AddToMinistry({
  personId,
  ministries,
  label = "Adicionar a ministério",
}: {
  personId: string;
  ministries: { id: string; name: string }[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [ministryId, setMinistryId] = useState("");
  const [role, setRole] = useState<"member" | "leader">("member");
  const add = useAction(addToMinistryAction, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!ministries.length}>
        <Plus data-icon="inline-start" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar a ministério</DialogTitle>
            <DialogDescription>O vínculo começa hoje e fica no histórico mesmo depois de encerrado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
            <FormField label="Ministério" htmlFor="am-ministry">
              <NativeSelect id="am-ministry" value={ministryId} onChange={(e) => setMinistryId(e.target.value)}>
                <option value="" disabled>Escolha…</option>
                {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label="Função" htmlFor="am-role">
              <NativeSelect id="am-role" value={role} onChange={(e) => setRole(e.target.value as "member" | "leader")}>
                <option value="member">Participante</option>
                <option value="leader">Líder</option>
              </NativeSelect>
            </FormField>
          </div>
          <DialogFooter>
            <Button disabled={!ministryId || add.pending} onClick={() => add.run(personId, ministryId, role)}>
              {add.pending ? <Spinner /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MembershipMenu({ id, role }: { id: string; role: "member" | "leader" }) {
  const setRole = useAction(setMembershipRoleAction);
  const end = useAction(endMembershipAction);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ações do vínculo" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {role === "member" ? (
          <DropdownMenuItem onClick={() => setRole.run(id, "leader")}><Crown /> Tornar líder</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => setRole.run(id, "member")}><UserRound /> Tornar participante</DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={() => end.run(id)}><LogOut /> Encerrar vínculo</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
