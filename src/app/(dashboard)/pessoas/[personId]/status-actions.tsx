"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { inactivatePersonAction, promotePersonAction, type PersonStatusActionState } from "./actions";

export function PersonStatusActions({ personId, fullName, status }: { personId: string; fullName: string; status: "VISITOR" | "MEMBER" | "INACTIVE" }) {
  const [promotionState, promotionFormAction, isPromotionPending] = useActionState<PersonStatusActionState, FormData>(promotePersonAction, {});
  const [inactivationState, inactivationFormAction, isInactivationPending] = useActionState<PersonStatusActionState, FormData>(inactivatePersonAction, {});

  if (status === "INACTIVE") return null;

  return (
    <section aria-label="Ações de status" className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-[#26766d]">Ações de status</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Atualizar Pessoa</h2>
      </div>
      {status === "VISITOR" ? (
        <form action={promotionFormAction} className="grid gap-4 border-b border-slate-100 pb-5">
          <input type="hidden" name="personId" value={personId} />
          <h3 className="font-semibold text-slate-900">Promover a membro</h3>
          <Input id="promotion-phone" name="phone" label="Telefone para promoção" type="tel" required />
          <Input id="promotion-birth-date" name="birthDate" label="Data de nascimento para promoção" type="date" required />
          <Input id="promotion-effective-date" name="effectiveDate" label="Data efetiva da promoção" type="date" required />
          {promotionState.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{promotionState.error}</p> : null}
          <Button type="submit" disabled={isPromotionPending}>{isPromotionPending ? "Promovendo..." : "Promover a membro"}</Button>
        </form>
      ) : null}
      <form
        action={inactivationFormAction}
        className="grid gap-4"
        onSubmit={(event) => {
          if (!window.confirm(`Inativar a Pessoa ${fullName}? O perfil e o histórico serão preservados.`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="personId" value={personId} />
        <Input id="inactivation-effective-date" name="effectiveDate" label="Data efetiva da inativação" type="date" required />
        {inactivationState.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{inactivationState.error}</p> : null}
        <Button type="submit" variant="danger" disabled={isInactivationPending}>{isInactivationPending ? "Inativando..." : "Inativar Pessoa"}</Button>
      </form>
    </section>
  );
}
