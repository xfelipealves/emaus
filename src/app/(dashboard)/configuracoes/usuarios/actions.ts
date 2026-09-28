"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/session-service";
import { grantMinistryAccess, revokeMinistryAccess } from "@/features/ministerios/access-scope-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { createAccount, deactivateAccount } from "@/features/auth/account-service";

async function requireAdministrator() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem gerenciar contas.");
  }
  return account;
}

export type AccountActionState = { error?: string; success?: string };
export type MinistryAccessActionState = { error?: string; success?: string };

export async function grantMinistryAccessAction(
  _previousState: MinistryAccessActionState,
  formData: FormData,
): Promise<MinistryAccessActionState> {
  try {
    const actor = await requireAdministrator();
    await grantMinistryAccess(
      { id: actor.id, role: actor.role },
      {
        accountId: String(formData.get("accountId") ?? ""),
        ministryId: String(formData.get("ministryId") ?? ""),
      },
    );
    revalidatePath("/configuracoes/usuarios");
    revalidatePath("/ministerios");
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
    await revokeMinistryAccess(
      { id: actor.id, role: actor.role },
      {
        accountId: String(formData.get("accountId") ?? ""),
        ministryId: String(formData.get("ministryId") ?? ""),
      },
    );
    revalidatePath("/configuracoes/usuarios");
    revalidatePath("/ministerios");
    return { success: "Acesso revogado. O histórico foi preservado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível revogar o acesso." };
  }
}

export async function createAccountAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const actor = await requireAdministrator();
    await createAccount(actor, {
      personId: String(formData.get("personId") ?? ""),
      username: String(formData.get("username") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? "SECRETARY") as "ADMINISTRATOR" | "SECRETARY" | "LEADER",
    });
    revalidatePath("/configuracoes/usuarios");
    return { success: "Conta criada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a conta." };
  }
}

export async function deactivateAccountAction(formData: FormData): Promise<void> {
  const actor = await requireAdministrator();
  await deactivateAccount(actor, String(formData.get("accountId") ?? ""));
  revalidatePath("/configuracoes/usuarios");
}
