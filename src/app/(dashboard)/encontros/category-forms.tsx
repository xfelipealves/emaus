"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { createCategoryAction, updateCategoryAction, type CategoryActionState } from "./actions";

export function CreateCategoryForm() {
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(createCategoryAction, {});

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-semibold">Nova categoria</h2><p className="mt-1 text-sm text-slate-500">Categorias ajudam a organizar e consultar os encontros.</p></div>
      <Input id="category-name" name="name" label="Nome" required />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="category-description">
        <span>Descrição <span className="font-normal text-slate-400">(opcional)</span></span>
        <textarea id="category-description" name="description" rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]" />
      </label>
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Criando..." : "Criar categoria"}</Button>
    </form>
  );
}

export function EditCategoryForm({ category }: { category: { id: string; name: string; description: string | null } }) {
  const [state, formAction, isPending] = useActionState<CategoryActionState, FormData>(updateCategoryAction, {});

  return (
    <form action={formAction} className="grid gap-3 border-t border-slate-100 pt-4">
      <input type="hidden" name="categoryId" value={category.id} />
      <Input id={`category-name-${category.id}`} name="name" label="Nome" defaultValue={category.name} required />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`category-description-${category.id}`}>
        <span>Descrição <span className="font-normal text-slate-400">(opcional)</span></span>
        <textarea id={`category-description-${category.id}`} name="description" defaultValue={category.description ?? ""} rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]" />
      </label>
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Salvando..." : "Salvar alterações"}</Button>
    </form>
  );
}
