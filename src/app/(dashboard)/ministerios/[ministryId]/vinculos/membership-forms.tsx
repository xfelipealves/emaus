"use client";

import { useActionState } from "react";
import type { MinistryMembershipRole } from "@prisma/client";
import { Button, Input } from "@/components/ui";
import { BRAZIL_TIME_ZONE } from "@/lib/dates";
import {
  createMembershipAction,
  endMembershipAction,
  updateMembershipRoleAction,
  type MembershipActionState,
} from "./memberships-actions";

const personStatusLabels = { VISITOR: "Visitante", MEMBER: "Membro", INACTIVE: "Inativa" } as const;

function currentBrazilDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function CreateMembershipForm({
  ministryId,
  people,
  activePersonIds,
}: {
  ministryId: string;
  people: Array<{ id: string; fullName: string; status: keyof typeof personStatusLabels }>;
  activePersonIds: string[];
}) {
  const [state, formAction, isPending] = useActionState<MembershipActionState, FormData>(createMembershipAction, {});

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-[#26766d]">Composição do Ministério</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Vincular uma Pessoa</h2>
        <p className="mt-1 text-sm text-slate-500">A entrada fica registrada no perfil e na timeline da Pessoa.</p>
      </div>
      <input type="hidden" name="ministryId" value={ministryId} />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="membership-person">
        <span>Pessoa</span>
        <select id="membership-person" name="personId" required defaultValue="" className="field-control min-h-11 w-full text-sm">
          <option value="" disabled>Selecione uma Pessoa</option>
          {people.map((person) => {
            const alreadyLinked = activePersonIds.includes(person.id);
            return <option key={person.id} value={person.id} disabled={alreadyLinked}>{person.fullName} · {personStatusLabels[person.status]}{alreadyLinked ? " · já vinculada" : ""}</option>;
          })}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="membership-role">
        <span>Cargo ministerial</span>
        <select id="membership-role" name="role" required defaultValue="" className="field-control min-h-11 w-full text-sm">
          <option value="" disabled>Selecione um cargo</option>
          <option value="MEMBER">Membro</option>
          <option value="LEADER">Líder</option>
        </select>
      </label>
      <Input id="membership-start-date" name="startDate" label="Data de entrada" type="date" defaultValue={currentBrazilDateInputValue()} required />
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" disabled={isPending || people.length === 0}>{isPending ? "Vinculando..." : "Vincular pessoa"}</Button>
      {people.length === 0 ? <p className="text-sm text-slate-500">Cadastre uma Pessoa antes de criar o vínculo.</p> : null}
    </form>
  );
}

export function MembershipRoleForm({ membership }: {
  membership: { id: string; role: MinistryMembershipRole; person: { fullName: string } };
}) {
  const [state, formAction, isPending] = useActionState<MembershipActionState, FormData>(updateMembershipRoleAction, {});
  const nextRole = membership.role === "MEMBER" ? "LEADER" : "MEMBER";
  const nextRoleLabel = nextRole === "LEADER" ? "líder" : "membro";

  return (
    <form action={formAction} className="mt-3 grid gap-3 border-t border-slate-100 pt-3">
      <input type="hidden" name="membershipId" value={membership.id} />
      <input type="hidden" name="role" value={nextRole} />
      <Input id={`role-effective-${membership.id}`} name="effectiveDate" label="Data efetiva do cargo" type="date" defaultValue={currentBrazilDateInputValue()} required />
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Salvando..." : `Tornar ${nextRoleLabel}`}</Button>
    </form>
  );
}

export function EndMembershipForm({ membership }: {
  membership: { id: string; person: { fullName: string } };
}) {
  const [state, formAction, isPending] = useActionState<MembershipActionState, FormData>(endMembershipAction, {});

  return (
    <form
      action={formAction}
      className="mt-3 grid gap-3 border-t border-slate-100 pt-3"
      onSubmit={(event) => {
        if (!window.confirm(`Encerrar o vínculo de ${membership.person.fullName}? O histórico será preservado.`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="membershipId" value={membership.id} />
      <Input id={`membership-end-${membership.id}`} name="endDate" label="Data de saída" type="date" defaultValue={currentBrazilDateInputValue()} required />
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" variant="danger" disabled={isPending}>{isPending ? "Encerrando..." : "Encerrar vínculo"}</Button>
    </form>
  );
}
