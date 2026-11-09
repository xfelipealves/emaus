"use server";

import { redirect } from "next/navigation";
import type { HouseholdRole } from "@/db/schema";
import { formToObject, runAction } from "@/server/action";
import { createHousehold, deleteHousehold, setHouseholdMember, updateHousehold } from "@/server/households";
import { ActionError, requireUser } from "@/server/session";

export async function createHouseholdAction(form: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role === "leader") throw new ActionError("Sem permissão para criar famílias.");
    const h = await createHousehold(formToObject(form));
    return { id: h.id };
  }, "Família criada");
}

export async function updateHouseholdAction(id: string, form: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role === "leader") throw new ActionError("Sem permissão para editar famílias.");
    await updateHousehold(id, formToObject(form));
  }, "Família atualizada");
}

export async function deleteHouseholdAction(id: string) {
  const user = await requireUser();
  if (user.role === "leader") return { ok: false as const, error: "Sem permissão." };
  const result = await runAction(() => deleteHousehold(id));
  if (result.ok) redirect("/familias");
  return result;
}

export async function setMemberAction(householdId: string, personId: string, role: HouseholdRole | null) {
  return runAction(async () => setHouseholdMember(await requireUser(), householdId, personId, role), role ? "Membro adicionado" : "Membro removido");
}
