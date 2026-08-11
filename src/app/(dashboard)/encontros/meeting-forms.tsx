"use client";

import { useActionState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { createMeetingAction, type MeetingActionState } from "./actions";

type Option = { id: string; name: string };

export function CreateMeetingForm({ categories, ministries }: { categories: Option[]; ministries: Option[] }) {
  const [state, formAction, isPending] = useActionState<MeetingActionState, FormData>(createMeetingAction, {});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const status = new FormData(event.currentTarget).get("status");
    if (status === "CANCELLED" && !window.confirm("Cancelar este encontro? Ele ficará preservado para consulta e não aceitará presença.")) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-semibold">Novo encontro</h2><p className="mt-1 text-sm text-slate-500">Defina quando será e quem deve aparecer na frequência.</p></div>
      <Input id="title" name="title" label="Título" required />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="categoryId">Categoria<select id="categoryId" name="categoryId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="scheduledAt">Data e horário<input id="scheduledAt" name="scheduledAt" type="datetime-local" required className="rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-[#26766d]" /></label>
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="status">Estado<select id="status" name="status" defaultValue="DRAFT" className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]"><option value="DRAFT">Rascunho</option><option value="SCHEDULED">Agendado</option><option value="CANCELLED">Cancelado</option></select></label>
      <fieldset className="grid gap-3"><legend className="text-sm font-medium text-slate-700">Público</legend><label className="flex items-center gap-2 text-sm"><input type="radio" name="audience" value="whole-church" defaultChecked />Toda a igreja</label><label className="flex items-center gap-2 text-sm"><input type="radio" name="audience" value="ministries" />Ministérios selecionados</label><div className="grid gap-2 sm:grid-cols-2">{ministries.map((ministry) => <label key={ministry.id} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="ministryIds" value={ministry.id} />{ministry.name}</label>)}</div></fieldset>
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Criando..." : "Criar encontro"}</Button>
    </form>
  );
}
