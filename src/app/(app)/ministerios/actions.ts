"use server";

import { formToObject, runAction } from "@/server/action";
import { addMember, createMinistry, setMinistryArchived, updateMinistry } from "@/server/ministries";
import { ActionError, can, requireUser } from "@/server/session";

async function requireManager() {
  const user = await requireUser();
  if (!can.manageMinistries(user)) throw new ActionError("Apenas administradores gerenciam ministérios.");
  return user;
}

export async function saveMinistryAction(id: string | null, form: FormData) {
  return runAction(async () => {
    const user = await requireManager();
    if (id) {
      await updateMinistry(user, id, formToObject(form));
      return { id };
    }
    return { id: (await createMinistry(user, formToObject(form))).id };
  }, id ? "Ministério atualizado" : "Ministério criado");
}

export async function archiveMinistryAction(id: string, archived: boolean) {
  return runAction(async () => setMinistryArchived(await requireManager(), id, archived), archived ? "Ministério arquivado" : "Ministério reativado");
}

export async function addMembersAction(ministryId: string, personIds: string[]) {
  return runAction(async () => {
    const user = await requireUser();
    for (const id of personIds) await addMember(user, ministryId, id, "member");
  }, personIds.length === 1 ? "Pessoa adicionada" : `${personIds.length} pessoas adicionadas`);
}
