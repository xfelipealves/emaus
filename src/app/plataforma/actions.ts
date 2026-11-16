"use server";

import { revalidatePath } from "next/cache";
import { formToObject, runAction } from "@/server/action";
import { createChurch, setChurchActive, setChurchBudget, setPlatformBudget } from "@/server/platform";
import { requirePlatformAdmin } from "@/server/session";

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
