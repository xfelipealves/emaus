"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { HouseholdRole, PersonStatus } from "@/db/schema";
import { formToObject, runAction } from "@/server/action";
import { addNote, completeFollowUp, createFollowUp, deleteFollowUp, deleteNote, editNote, reopenFollowUp, toggleNotePin } from "@/server/care";
import { createHousehold, setHouseholdMember } from "@/server/households";
import { importPeople } from "@/server/import";
import { addMember, endMembership, setMembershipRole } from "@/server/ministries";
import { changeStatus, createPerson, deletePerson, updatePerson } from "@/server/people";
import { ActionError, can, requireUser } from "@/server/session";
import type { ImportField } from "@/lib/csv";

export async function createPersonAction(form: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const person = await createPerson(user, formToObject(form));
    revalidatePath("/pessoas");
    return { id: person.id };
  }, "Pessoa cadastrada");
}

export async function updatePersonAction(id: string, form: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await updatePerson(user, id, formToObject(form));
  }, "Cadastro atualizado");
}

export async function changeStatusAction(id: string, status: PersonStatus, reason?: string) {
  return runAction(async () => {
    const user = await requireUser();
    await changeStatus(user, id, status, reason);
  }, "Status atualizado");
}

export async function deletePersonAction(id: string) {
  const user = await requireUser();
  if (!can.deletePeople(user)) return { ok: false as const, error: "Apenas administradores podem excluir cadastros." };
  const result = await runAction(() => deletePerson(user, id));
  if (result.ok) redirect("/pessoas");
  return result;
}

export async function addNoteAction(personId: string, content: string) {
  return runAction(async () => addNote(await requireUser(), personId, content), "Anotação salva");
}

export async function editNoteAction(noteId: string, content: string) {
  return runAction(async () => editNote(await requireUser(), noteId, content), "Anotação editada");
}

export async function toggleNotePinAction(noteId: string) {
  return runAction(async () => toggleNotePin(await requireUser(), noteId));
}

export async function deleteNoteAction(noteId: string) {
  return runAction(async () => deleteNote(await requireUser(), noteId), "Anotação excluída");
}

export async function createFollowUpAction(form: FormData) {
  return runAction(async () => {
    await createFollowUp(await requireUser(), formToObject(form));
    revalidatePath("/cuidado");
  }, "Acompanhamento criado");
}

export async function completeFollowUpAction(id: string, outcome?: string) {
  return runAction(async () => completeFollowUp(await requireUser(), id, outcome), "Acompanhamento concluído");
}

export async function reopenFollowUpAction(id: string) {
  return runAction(async () => reopenFollowUp(await requireUser(), id), "Acompanhamento reaberto");
}

export async function deleteFollowUpAction(id: string) {
  return runAction(async () => deleteFollowUp(await requireUser(), id), "Acompanhamento excluído");
}

export async function addToMinistryAction(personId: string, ministryId: string, role: "member" | "leader") {
  return runAction(async () => addMember(await requireUser(), ministryId, personId, role), "Vínculo criado");
}

export async function endMembershipAction(membershipId: string) {
  return runAction(async () => endMembership(await requireUser(), membershipId), "Vínculo encerrado");
}

export async function setMembershipRoleAction(membershipId: string, role: "member" | "leader") {
  return runAction(async () => setMembershipRole(await requireUser(), membershipId, role), "Função atualizada");
}

export async function setHouseholdAction(personId: string, householdId: string | null, role: HouseholdRole | null, newHouseholdName?: string) {
  return runAction(async () => {
    const user = await requireUser();
    let target = householdId;
    if (!target && newHouseholdName) target = (await createHousehold({ name: newHouseholdName })).id;
    if (!target) throw new ActionError("Escolha uma família.");
    await setHouseholdMember(user, target, personId, role);
    revalidatePath("/familias");
    return { householdId: target };
  }, role ? "Família atualizada" : "Removido da família");
}

export async function importPeopleAction(rows: Record<string, string>[], mapping: Partial<Record<ImportField, string>>) {
  return runAction(async () => {
    const user = await requireUser();
    if (!can.importPeople(user)) throw new ActionError("Você não tem permissão para importar.");
    if (rows.length > 5000) throw new ActionError("Importe no máximo 5.000 linhas por vez.");
    if (!mapping.fullName) throw new ActionError("Indique qual coluna tem o nome.");
    const summary = await importPeople(user, rows, mapping);
    revalidatePath("/pessoas");
    return summary;
  });
}
