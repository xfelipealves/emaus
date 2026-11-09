"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { resetAccountPasswordAction, type AccountActionState } from "./actions";

type ResettableAccount = {
  id: string;
  personName: string;
  username: string;
};

export function AccountResetForm({
  accounts,
  defaultAccountId,
}: {
  accounts: ResettableAccount[];
  defaultAccountId: string;
}) {
  const [state, formAction, isPending] = useActionState<AccountActionState, FormData>(
    resetAccountPasswordAction,
    {},
  );

  if (accounts.length === 0) return null;

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Redefinir senha manualmente</h2>
        <p className="mt-1 text-sm text-slate-500">Escolha uma conta ativa e informe uma nova senha.</p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="accountId">
        <span>Conta</span>
        <select id="accountId" name="accountId" defaultValue={defaultAccountId} required className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950">
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.personName} · @{account.username}</option>
          ))}
        </select>
      </label>
      <Input id="newPassword" name="password" label="Nova senha" type="password" autoComplete="new-password" required />
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Redefinindo..." : "Redefinir senha"}</Button>
    </form>
  );
}
