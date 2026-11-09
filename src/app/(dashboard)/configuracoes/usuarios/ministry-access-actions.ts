"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/session-service";
import { grantMinistryAccess, revokeMinistryAccess } from "@/features/ministerios/access-scope-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export type MinistryAccessActionState = { error?: string; success?: string };

async function requireAdministrator() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem gerenciar escopos ministeriais.");
  }
  return { id: account.id, role: account.role };
}

function readRequiredId(formData: FormData, field: "accountId" | "ministryId") {
  const value = formData.get(field);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(field === "accountId" ? "Selecione um Líder." : "Selecione um Ministério.");
  }
  return value.trim();
}

function revalidateAccessPages() {
  revalidatePath("/configuracoes/usuarios");
  revalidatePath("/ministerios");
  revalidatePath("/ministerios/frequencia");
  revalidatePath("/encontros");
}

export async function grantMinistryAccessAction(
  _previousState: MinistryAccessActionState,
  formData: FormData,
): Promise<MinistryAccessActionState> {
  try {
    const actor = await requireAdministrator();
    const input = {
      accountId: readRequiredId(formData, "accountId"),
      ministryId: readRequiredId(formData, "ministryId"),
    };
    await grantMinistryAccess(actor, input);
    revalidateAccessPages();
    return { success: "Acesso concedido ao Ministério." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível conceder o acesso." };
  }
}

export async function revokeMinistryAccessAction(
  _previousState: MinistryAccessActionState,
  formData: FormData,
): Promise<MinistryAccessActionState> {
  try {
    const actor = await requireAdministrator();
    const input = {
      accountId: readRequiredId(formData, "accountId"),
      ministryId: readRequiredId(formData, "ministryId"),
    };
    await revokeMinistryAccess(actor, input);
    revalidateAccessPages();
    return { success: "Acesso revogado. O histórico foi preservado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível revogar o acesso." };
  }
}
