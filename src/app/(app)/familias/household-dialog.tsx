"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/hooks/use-action";
import { createHouseholdAction, updateHouseholdAction } from "./actions";

export function HouseholdDialog({ initial }: { initial?: { id: string; name: string; address: string | null; phone: string | null } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = useAction(createHouseholdAction, {
    onSuccess: (d) => {
      setOpen(false);
      router.push(`/familias/${d.id}`);
    },
  });
  const update = useAction((form: FormData) => updateHouseholdAction(initial!.id, form), { onSuccess: () => setOpen(false) });
  const action = initial ? update : create;

  return (
    <>
      {initial ? (
        <Button variant="outline" onClick={() => setOpen(true)}><Pencil data-icon="inline-start" /> Editar</Button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus data-icon="inline-start" /> Nova família</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{initial ? "Editar família" : "Nova família"}</DialogTitle>
          </DialogHeader>
          <form
            id="household-form"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              action.run(new FormData(e.currentTarget));
            }}
          >
            <FormField label="Nome" htmlFor="hh-name" error={action.fieldErrors.name}>
              <Input id="hh-name" name="name" defaultValue={initial?.name ?? "Família "} required autoFocus />
            </FormField>
            <FormField label="Endereço" htmlFor="hh-address">
              <Input id="hh-address" name="address" defaultValue={initial?.address ?? ""} />
            </FormField>
            <FormField label="Telefone fixo" htmlFor="hh-phone">
              <Input id="hh-phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} />
            </FormField>
          </form>
          <DialogFooter>
            <Button type="submit" form="household-form" disabled={action.pending}>
              {action.pending ? <Spinner /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
