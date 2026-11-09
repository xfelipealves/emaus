"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { TONE_LABEL, TONES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { saveMinistryAction } from "./actions";

export function TonePicker({ name, defaultValue = "ember" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      <input type="hidden" name={name} value={value} />
      {TONES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          aria-label={TONE_LABEL[t]}
          title={TONE_LABEL[t]}
          data-tone={t}
          onClick={() => setValue(t)}
          className={cn("size-8 rounded-full bg-tone ring-offset-2 ring-offset-background transition-transform hover:scale-110", value === t && "ring-2 ring-tone")}
        />
      ))}
    </div>
  );
}

export function MinistryDialog({ initial }: { initial?: { id: string; name: string; description: string | null; color: string } }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const save = useAction((form: FormData) => saveMinistryAction(initial?.id ?? null, form), {
    onSuccess: (d) => {
      setOpen(false);
      if (!initial) router.push(`/ministerios/${d.id}`);
    },
  });
  return (
    <>
      {initial ? (
        <Button variant="outline" onClick={() => setOpen(true)}><Pencil data-icon="inline-start" /> Editar</Button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus data-icon="inline-start" /> Novo ministério</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{initial ? "Editar ministério" : "Novo ministério"}</DialogTitle></DialogHeader>
          <form id="ministry-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.run(new FormData(e.currentTarget)); }}>
            <FormField label="Nome" htmlFor="m-name" error={save.fieldErrors.name}>
              <Input id="m-name" name="name" defaultValue={initial?.name} required autoFocus />
            </FormField>
            <FormField label="Descrição" htmlFor="m-desc">
              <Textarea id="m-desc" name="description" rows={2} defaultValue={initial?.description ?? ""} />
            </FormField>
            <FormField label="Cor">
              <TonePicker name="color" defaultValue={initial?.color} />
            </FormField>
          </form>
          <DialogFooter>
            <Button type="submit" form="ministry-form" disabled={save.pending}>{save.pending ? <Spinner /> : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
