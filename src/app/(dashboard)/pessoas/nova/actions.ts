"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { registerPerson } from "@/features/pessoas/person-actions";
import { parseDateInput } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export type PersonActionState = { error?: string };

async function requirePersonManager() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || !["ADMINISTRATOR", "SECRETARY"].includes(account.role)) {
    throw new Error("Você não tem permissão para cadastrar Pessoas.");
  }
  return account;
}

export async function createPersonAction(
  _previousState: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  let personId: string;
  try {
    const actor = await requirePersonManager();
    const type = String(formData.get("type") ?? "visitor");
    if (type !== "visitor" && type !== "member") {
      throw new Error("Tipo de cadastro inválido.");
    }

    const birthDateValue = String(formData.get("birthDate") ?? "");
    const person = await registerPerson(
      { id: actor.id, role: actor.role },
      {
        type,
        fullName: String(formData.get("fullName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        birthDate: birthDateValue ? parseDateInput(birthDateValue) : undefined,
      },
    );

    personId = person.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível cadastrar a Pessoa." };
  }

  redirect(`/pessoas/${personId}`);
}
