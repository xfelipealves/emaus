"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import { formToObject, runAction } from "@/server/action";
import { createChurch, setChurchActive, setChurchBudget, setPlatformBudget } from "@/server/platform";
import { ActionError, requirePlatformAdmin } from "@/server/session";
import { passwordRule } from "@/server/users";

export async function createChurchAction(form: FormData) {
  return runAction(async () => {
    const church = await createChurch(await requirePlatformAdmin(), formToObject(form));
    revalidatePath("/plataforma");
    return { id: church.id };
  }, "Igreja criada");
}

export async function setChurchActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    await setChurchActive(await requirePlatformAdmin(), id, active);
    revalidatePath("/plataforma", "layout");
  }, active ? "Igreja reativada" : "Acesso da igreja suspenso");
}

export async function saveChurchBudgetAction(id: string, form: FormData) {
  return runAction(async () => {
    await setChurchBudget(await requirePlatformAdmin(), id, formToObject(form));
    revalidatePath("/plataforma", "layout");
  }, "Limites salvos");
}

export async function savePlatformBudgetAction(form: FormData) {
  return runAction(async () => {
    await requirePlatformAdmin();
    await setPlatformBudget(formToObject(form));
    revalidatePath("/plataforma", "layout");
  }, "Limite global salvo");
}

/** Troca da própria senha da conta de operador (inclusive a provisória do primeiro acesso). */
export async function changeOperatorPasswordAction(currentPassword: string, newPassword: string) {
  return runAction(async () => {
    const account = await requirePlatformAdmin({ pendingPassword: true });
    passwordRule.parse(newPassword);
    if (newPassword === currentPassword) throw new ActionError("A nova senha precisa ser diferente da atual.");
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch {
      throw new ActionError("Senha atual incorreta.");
    }
    await db.update(schema.user).set({ mustChangePassword: false }).where(eq(schema.user.id, account.id));
  }, "Senha alterada");
}
