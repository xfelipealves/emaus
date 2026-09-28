"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { formatDateOnly } from "@/lib/dates";
import {
  createMembershipAction,
  endMembershipAction,
  updateMembershipRoleAction,
  type MembershipActionState,
} from "./memberships-actions";

type PersonOption = { id: string; fullName: string; status: "VISITOR" | "MEMBER" | "INACTIVE" };
type MembershipFormItem = {
  id: string;
  personId: string;
  role: "MEMBER" | "LEADER";
  startDate: Date;
};

const statusLabels = { VISITOR: "Visitante", MEMBER: "Membro", INACTIVE: "Inativa" } as const;

function todayInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function Feedback({ state }: { state: MembershipActionState }) {
  return <>
    {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
    {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
  </>;
}

function RoleSelect({ id, name, label, defaultValue }: { id: string; name: string; label: string; defaultValue?: "MEMBER" | "LEADER" }) {
  return <label htmlFor={id} className="grid gap-2 text-sm font-medium text-slate-700">
    <span>{label}</span>
    <select id={id} name={name} defaultValue={defaultValue ?? "MEMBER"} required className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]">
      <option value="MEMBER">Membro</option>
      <option value="LEADER">Líder</option>
    </select>
  </label>;
}

export function CreateMembershipForm({
  ministryId,
  people,
  activePersonIds,
}: {
  ministryId: string;
  people: PersonOption[];
  activePersonIds: string[];
}) {
  const [state, formAction, isPending] = useActionState<MembershipActionState, FormData>(createMembershipAction, {});
  return <form action={formAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <input type="hidden" name="ministryId" value={ministryId} />
    <div>
      <h2 className="text-lg font-semibold text-slate-950">Novo vínculo</h2>
      <p className="mt-1 text-sm text-slate-500">Registre a participação da Pessoa e a data efetiva de entrada.</p>
    </div>
    <label htmlFor="membership-person" className="grid gap-2 text-sm font-medium text-slate-700">
      <span>Pessoa</span>
      <select id="membership-person" name="personId" required disabled={people.length === 0} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]">
        <option value="">Selecione uma Pessoa</option>
        {people.map((person) => {
          const alreadyLinked = activePersonIds.includes(person.id);
          return <option key={person.id} value={person.id} disabled={alreadyLinked}>
            {person.fullName} · {statusLabels[person.status]}{alreadyLinked ? " · já vinculada" : ""}
          </option>;
        })}
      </select>
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
      <RoleSelect id="membership-role" name="role" label="Cargo" />
      <Input id="membership-start-date" name="startDate" label="Data de entrada" type="date" defaultValue={todayInputValue()} max={todayInputValue()} required />
    </div>
    <Feedback state={state} />
    <Button type="submit" disabled={isPending || people.length === 0}>{isPending ? "Criando..." : "Criar vínculo"}</Button>
  </form>;
}

export function MembershipRoleForm({ ministryId, membership, personName }: { ministryId: string; membership: MembershipFormItem; personName: string }) {
  const [state, formAction, isPending] = useActionState<MembershipActionState, FormData>(updateMembershipRoleAction, {});
  return <form action={formAction} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
    <input type="hidden" name="ministryId" value={ministryId} />
    <input type="hidden" name="membershipId" value={membership.id} />
    <input type="hidden" name="personId" value={membership.personId} />
    <RoleSelect id={`membership-role-${membership.id}`} name="role" label="Novo cargo" defaultValue={membership.role} />
    <Input id={`membership-role-date-${membership.id}`} name="effectiveDate" label="Data efetiva do cargo" type="date" defaultValue={todayInputValue()} min={membership.startDate.toISOString().slice(0, 10)} max={todayInputValue()} required />
    <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Salvando..." : "Salvar cargo"}</Button>
    <div className="sm:col-span-3"><Feedback state={state} /></div>
    <span className="sr-only">Cargo de {personName}</span>
  </form>;
}

export function MembershipEndForm({ ministryId, membership, personName }: { ministryId: string; membership: MembershipFormItem; personName: string }) {
  const [state, formAction, isPending] = useActionState<MembershipActionState, FormData>(endMembershipAction, {});
  return <form
    action={formAction}
    className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
    onSubmit={(event) => {
      if (!window.confirm(`Encerrar o vínculo de ${personName}? O histórico será preservado.`)) event.preventDefault();
    }}
  >
    <input type="hidden" name="ministryId" value={ministryId} />
    <input type="hidden" name="membershipId" value={membership.id} />
    <input type="hidden" name="personId" value={membership.personId} />
    <Input id={`membership-end-date-${membership.id}`} name="endDate" label="Data de saída" type="date" defaultValue={todayInputValue()} min={membership.startDate.toISOString().slice(0, 10)} max={todayInputValue()} required />
    <Button type="submit" variant="danger" disabled={isPending}>{isPending ? "Encerrando..." : `Encerrar vínculo de ${personName}`}</Button>
    <div className="sm:col-span-2"><Feedback state={state} /></div>
  </form>;
}

export function MembershipHistoryItem({
  personId,
  personName,
  role,
  startDate,
  endDate,
}: {
  personId: string;
  personName: string;
  role: "MEMBER" | "LEADER";
  startDate: Date;
  endDate?: Date | null;
}) {
  return <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
    <div className="min-w-0">
      <Link href={`/pessoas/${personId}`} className="block truncate font-medium text-slate-700 hover:text-[#26766d]">{personName}</Link>
      <span className="mt-1 block text-xs text-slate-500">{role === "LEADER" ? "Líder" : "Membro"}</span>
    </div>
    <span className="shrink-0 text-left text-xs text-slate-500 sm:text-right">
      {endDate
        ? <>Entrada: {formatDateOnly(startDate)}<br />Saída: {formatDateOnly(endDate)}</>
        : `Desde ${formatDateOnly(startDate)}`}
    </span>
  </li>;
}
