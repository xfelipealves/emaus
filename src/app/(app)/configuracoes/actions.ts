"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { formToObject, runAction } from "@/server/action";
import { deleteCategory, saveCategory } from "@/server/events";
import { recordAudit } from "@/server/history";
import { requireRole } from "@/server/session";
import { createUserAccount, resetUserPassword, revokeUserSessions, setUserActive, updateUserAccount } from "@/server/users";

const settingsInput = z.object({
  name: z.string().trim().min(2, "Informe o nome da igreja").max(80),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido"),
  careThresholdDays: z.coerce.number().int().min(7, "Mínimo 7 dias").max(180, "Máximo 180 dias"),
  allowSelfRegistration: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveSettingsAction(form: FormData) {
  return runAction(async () => {
    const user = await requireRole("admin");
    const input = settingsInput.parse(formToObject(form));
    await db.update(schema.churchSettings).set(input).where(eq(schema.churchSettings.id, 1));
    await recordAudit(db, { actorId: user.id, entity: "settings", entityId: "1", action: "update", summary: "Configurações da igreja atualizadas", after: input });
    revalidatePath("/", "layout");
  }, "Configurações salvas");
}

export async function createUserAction(form: FormData) {
  return runAction(async () => {
    const user = await requireRole("admin");
    const data = formToObject(form);
    await createUserAccount(user, data, String(form.get("password") ?? ""));
  }, "Conta criada");
}

export async function updateUserAction(id: string, form: FormData) {
  return runAction(async () => updateUserAccount(await requireRole("admin"), id, formToObject(form)), "Conta atualizada");
}

export async function setUserActiveAction(id: string, active: boolean) {
  return runAction(async () => setUserActive(await requireRole("admin"), id, active), active ? "Conta reativada" : "Conta desativada");
}

export async function revokeSessionsAction(id: string) {
  return runAction(async () => revokeUserSessions(await requireRole("admin"), id), "Sessões encerradas");
}

export async function resetPasswordAction(id: string, password: string) {
  return runAction(async () => resetUserPassword(await requireRole("admin"), id, password), "Senha redefinida");
}

export async function saveCategoryAction(id: string | null, form: FormData) {
  return runAction(async () => {
    await requireRole("admin");
    await saveCategory(id, formToObject(form));
  }, "Categoria salva");
}

export async function deleteCategoryAction(id: string) {
  return runAction(async () => {
    await requireRole("admin");
    await deleteCategory(id);
  }, "Categoria excluída");
}
