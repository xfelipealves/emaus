"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/app/form";
import { ToneDot } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { TonePicker } from "@/app/(app)/ministerios/ministry-dialog";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

type C = { id: string; name: string; color: string };

export function CategoriesManager({ categories }: { categories: C[] }) {
  const [editing, setEditing] = useState<C | "new" | null>(null);
  const del = useAction(deleteCategoryAction);
  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">Categorias dão cor e organizam a agenda: culto, célula, ensino, evento…</p>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            <ToneDot tone={c.color} className="size-3" />
            <span className="flex-1 text-sm font-medium">{c.name}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(c)}><Pencil /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => del.run(c.id)}><Trash2 /></Button>
          </li>
        ))}
        {categories.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma categoria.</li>}
      </ul>
      <Button variant="outline" onClick={() => setEditing("new")}><Plus data-icon="inline-start" /> Nova categoria</Button>
      {editing && <CategoryDialog category={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryDialog({ category, onClose }: { category: C | null; onClose: () => void }) {
  const save = useAction((f: FormData) => saveCategoryAction(category?.id ?? null, f), { onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
        <form id="cat-form" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.run(new FormData(e.currentTarget)); }}>
          <FormField label="Nome" htmlFor="c-name" error={save.fieldErrors.name}>
            <Input id="c-name" name="name" defaultValue={category?.name} required autoFocus />
          </FormField>
          <FormField label="Cor"><TonePicker name="color" defaultValue={category?.color} /></FormField>
        </form>
        <DialogFooter><Button type="submit" form="cat-form" disabled={save.pending}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
