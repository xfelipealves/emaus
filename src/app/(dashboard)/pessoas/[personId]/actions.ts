"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/session-service";
import { inactivatePerson, promoteToMember } from "@/features/pessoas/status-service";
import { parseDateInput } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export type PersonStatusActionState = { error?: string };

async function requirePersonManager() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || !["ADMINISTRATOR", "SECRETARY"].includes(account.role)) {
    throw new Error("Você não tem permissão para alterar o status da Pessoa.");
  }
  return account;
}

function parseRequiredDate(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "");
  if (!value) throw new Error("Informe a data efetiva da alteração.");
  return parseDateInput(value);
}

export async function promotePersonAction(
  _previousState: PersonStatusActionState,
  formData: FormData,
): Promise<PersonStatusActionState> {
  const personId = String(formData.get("personId") ?? "");
  try {
    const actor = await requirePersonManager();
    await promoteToMember(
      { id: actor.id, role: actor.role },
      personId,
      {
        phone: String(formData.get("phone") ?? ""),
        birthDate: parseDateInput(String(formData.get("birthDate") ?? "")),
        effectiveDate: parseRequiredDate(formData, "effectiveDate"),
      },
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível promover a Pessoa." };
  }

  revalidatePath(`/pessoas/${personId}`);
  redirect(`/pessoas/${personId}?status=promoted`);
}

export async function inactivatePersonAction(
  _previousState: PersonStatusActionState,
  formData: FormData,
): Promise<PersonStatusActionState> {
  const personId = String(formData.get("personId") ?? "");
  try {
    const actor = await requirePersonManager();
    await inactivatePerson(
      { id: actor.id, role: actor.role },
      personId,
      { effectiveDate: parseRequiredDate(formData, "effectiveDate") },
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível inativar a Pessoa." };
  }

  revalidatePath(`/pessoas/${personId}`);
  redirect(`/pessoas/${personId}?status=inactivated`);
}
