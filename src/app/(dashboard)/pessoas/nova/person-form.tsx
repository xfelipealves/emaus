"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { createPersonAction, type PersonActionState } from "./actions";

export function PersonForm() {
  const [state, formAction, isPending] = useActionState<PersonActionState, FormData>(createPersonAction, {});

  return (
    <form action={formAction} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-[#26766d]">Cadastro rápido</p>
        <h2 className="mt-1 text-xl font-semibold">Dados da Pessoa</h2>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="type">
        <span>Tipo de cadastro</span>
        <select id="type" name="type" defaultValue="visitor" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950">
          <option value="visitor">Visitante</option>
          <option value="member">Membro</option>
        </select>
      </label>
      <Input id="fullName" name="fullName" label="Nome completo" required />
      <Input id="phone" name="phone" label="Telefone" type="tel" />
      <Input id="birthDate" name="birthDate" label="Data de nascimento" type="date" />
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <a href="/pessoas" className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</a>
        <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Cadastrar Pessoa"}</Button>
      </div>
    </form>
  );
}
