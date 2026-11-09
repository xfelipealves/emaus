"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  grantMinistryAccessAction,
  revokeMinistryAccessAction,
  type MinistryAccessActionState,
} from "./ministry-access-actions";
import type { listLeaderScopeConfiguration } from "@/features/ministerios/access-scope-service";

type LeaderSettings = Awaited<ReturnType<typeof listLeaderScopeConfiguration>>;
type LeaderSetting = LeaderSettings[number];
type MinistryOption = { id: string; name: string };

export function MinistryAccessForm({
  leaders,
  ministries,
}: {
  leaders: LeaderSettings;
  ministries: MinistryOption[];
}) {
  const [state, formAction, isPending] = useActionState<MinistryAccessActionState, FormData>(grantMinistryAccessAction, {});

  return (
    <section aria-labelledby="ministry-access-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-[#26766d]">Permissões</p>
        <h2 id="ministry-access-heading" className="mt-1 text-lg font-semibold text-slate-950">Escopos ministeriais</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Conceda a cada Líder acesso apenas aos Ministérios de que precisa. Esse acesso não altera o cargo ministerial nem o papel da conta.</p>
      </div>

      <form action={formAction} className="mt-5 grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="scope-leader">
          <span>Líder</span>
          <select id="scope-leader" name="accountId" required className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950">
            <option value="">Selecione um Líder</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>{leader.person.fullName}{leader.status === "INACTIVE" ? " · conta desativada" : ""}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="scope-ministry">
          <span>Ministério</span>
          <select id="scope-ministry" name="ministryId" required className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950">
            <option value="">Selecione um Ministério ativo</option>
            {ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
          </select>
        </label>
        <Button type="submit" disabled={isPending || leaders.length === 0 || ministries.length === 0}>
          {isPending ? "Concedendo..." : "Conceder acesso"}
        </Button>
      </form>
      {state.error ? <p role="alert" className="mt-3 rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="mt-3 rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-800">Acessos vigentes por Líder</h3>
        {leaders.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhuma conta de Líder cadastrada.</p> : <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {leaders.map((leader) => <LeaderScopeCard key={leader.id} leader={leader} />)}
        </div>}
      </div>
    </section>
  );
}

function LeaderScopeCard({ leader }: { leader: LeaderSetting }) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium text-slate-900">{leader.person.fullName}</h4>
        <span className="text-xs text-slate-500">@{leader.username} · {leader.status === "ACTIVE" ? "Conta ativa" : "Conta desativada"}</span>
      </div>
      {leader.ministryAccess.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nenhum acesso vigente.</p> : <ul className="mt-3 divide-y divide-slate-100">
        {leader.ministryAccess.map((access) => <li key={access.ministryId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <span className="text-sm text-slate-700">{access.ministry.name}{access.ministry.status === "ARCHIVED" ? " · arquivado" : ""}</span>
          <RevokeMinistryAccessForm leader={leader} ministryId={access.ministryId} ministryName={access.ministry.name} />
        </li>)}
      </ul>}
    </article>
  );
}

function RevokeMinistryAccessForm({
  leader,
  ministryId,
  ministryName,
}: {
  leader: LeaderSetting;
  ministryId: string;
  ministryName: string;
}) {
  const [state, formAction, isPending] = useActionState<MinistryAccessActionState, FormData>(revokeMinistryAccessAction, {});

  return (
    <div className="grid justify-items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="accountId" value={leader.id} />
        <input type="hidden" name="ministryId" value={ministryId} />
        <Button type="submit" variant="danger" disabled={isPending} aria-label={`Revogar acesso de ${leader.person.fullName} ao Ministério ${ministryName}`}>
          {isPending ? "Revogando..." : "Revogar"}
        </Button>
      </form>
      {state.error ? <p role="alert" className="text-xs text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-xs text-[#155e58]">{state.success}</p> : null}
    </div>
  );
}
