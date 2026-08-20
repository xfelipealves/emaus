"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { createAccountAction, deactivateAccountAction, type AccountActionState } from "./actions";

export function CreateAccountForm({ people }: { people: Array<{ id: string; fullName: string }> }) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(createAccountAction, {});

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Nova conta</h2>
        <p className="mt-1 text-sm text-slate-500">Vincule o acesso a uma Pessoa já cadastrada.</p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="personId">
        <span>Pessoa</span>
        <select id="personId" name="personId" required className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950">
          <option value="">Selecione uma Pessoa</option>
          {people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
        </select>
      </label>
      <Input id="username" name="username" label="Nome de usuário" required />
      <Input id="email" name="email" label="E-mail" type="email" required />
      <Input id="password" name="password" label="Senha" type="password" required />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="role">
        <span>Papel</span>
        <select id="role" name="role" defaultValue="SECRETARY" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950">
          <option value="SECRETARY">Secretaria</option>
          <option value="LEADER">Líder</option>
          <option value="ADMINISTRATOR">Administrador</option>
        </select>
      </label>
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Criando..." : "Criar conta"}</Button>
    </form>
  );
}

export function DeactivateAccountForm({ accountId, personName }: { accountId: string; personName: string }) {
  return (
    <form action={deactivateAccountAction} onSubmit={(event) => {
      if (!window.confirm(`Desativar a conta de ${personName}? O histórico será preservado.`)) event.preventDefault();
    }}>
      <input type="hidden" name="accountId" value={accountId} />
      <Button type="submit" variant="danger">Desativar</Button>
    </form>
  );
}
