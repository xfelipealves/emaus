"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/session-service";
import { archiveMinistry, createMinistry, updateMinistry } from "@/features/ministerios/ministry-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";

async function requireAdministrator() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem gerenciar Ministérios.");
  }
  return { id: account.id, role: account.role, ministryAccess: [] } as const;
}

export type MinistryActionState = { error?: string; success?: string };

export async function createMinistryAction(_previousState: MinistryActionState, formData: FormData): Promise<MinistryActionState> {
  try {
    await createMinistry(await requireAdministrator(), {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    revalidatePath("/ministerios");
    return { success: "Ministério criado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o Ministério." };
  }
}

export async function updateMinistryAction(_previousState: MinistryActionState, formData: FormData): Promise<MinistryActionState> {
  try {
    await updateMinistry(await requireAdministrator(), String(formData.get("ministryId") ?? ""), {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    revalidatePath("/ministerios");
    return { success: "Ministério atualizado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar o Ministério." };
  }
}

export async function archiveMinistryAction(formData: FormData): Promise<void> {
  await archiveMinistry(await requireAdministrator(), String(formData.get("ministryId") ?? ""));
  revalidatePath("/ministerios");
}
