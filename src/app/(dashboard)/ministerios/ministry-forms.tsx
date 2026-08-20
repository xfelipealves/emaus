"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { archiveMinistryAction, createMinistryAction, updateMinistryAction, type MinistryActionState } from "./actions";

export function CreateMinistryForm() {
  const [state, formAction, isPending] = useActionState<MinistryActionState, FormData>(createMinistryAction, {});
  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-semibold">Novo Ministério</h2><p className="mt-1 text-sm text-slate-500">Organize as frentes de participação da igreja.</p></div>
      <Input id="name" name="name" label="Nome" required />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="description"><span>Descrição <span className="font-normal text-slate-400">(opcional)</span></span><textarea id="description" name="description" rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]" /></label>
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Criando..." : "Criar Ministério"}</Button>
    </form>
  );
}

export function EditMinistryForm({ ministry }: { ministry: { id: string; name: string; description: string | null } }) {
  const [state, formAction, isPending] = useActionState<MinistryActionState, FormData>(updateMinistryAction, {});
  return (
    <form action={formAction} className="grid gap-3 border-t border-slate-100 pt-4">
      <input type="hidden" name="ministryId" value={ministry.id} />
      <Input id={`name-${ministry.id}`} name="name" label="Nome" defaultValue={ministry.name} required />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`description-${ministry.id}`}><span>Descrição</span><textarea id={`description-${ministry.id}`} name="description" defaultValue={ministry.description ?? ""} rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]" /></label>
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Salvando..." : "Salvar alterações"}</Button>
    </form>
  );
}

export function ArchiveMinistryForm({ ministryId, ministryName }: { ministryId: string; ministryName: string }) {
  return (
    <form action={archiveMinistryAction} className="mt-3" onSubmit={(event) => {
      if (!window.confirm(`Arquivar o Ministério ${ministryName}? O histórico será preservado.`)) event.preventDefault();
    }}>
      <input type="hidden" name="ministryId" value={ministryId} />
      <Button type="submit" variant="danger">Arquivar Ministério</Button>
    </form>
  );
}
