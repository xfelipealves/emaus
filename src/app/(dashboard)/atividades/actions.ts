"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/session-service";
import {
  createActivity,
  createSubtask,
  deleteActivity,
  deleteSubtask,
  getActivityActor,
  updateActivity,
  updateSubtask,
  type ActivityBucket,
} from "@/features/atividades/activity-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export type ActivityActionState = { error?: string; success?: string };

async function requireActivityActor() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getActivityActor(account.id) : null;
  if (!actor) throw new Error("Sessão inválida.");
  return actor;
}

function formText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function revalidateActivities() {
  revalidatePath("/atividades");
}

export async function createActivityAction(
  _previousState: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  try {
    await createActivity(await requireActivityActor(), {
      title: formText(formData, "title"),
      description: formText(formData, "description"),
      bucket: formText(formData, "bucket") as ActivityBucket,
    });
    revalidateActivities();
    return { success: "Atividade criada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a atividade." };
  }
}

export async function updateActivityAction(
  _previousState: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  try {
    await updateActivity(await requireActivityActor(), formText(formData, "activityId"), {
      title: formText(formData, "title"),
      description: formText(formData, "description"),
      bucket: formText(formData, "bucket") as ActivityBucket,
    });
    revalidateActivities();
    return { success: "Área atualizada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar a atividade." };
  }
}

export async function deleteActivityAction(
  _previousState: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  try {
    await deleteActivity(await requireActivityActor(), formText(formData, "activityId"));
    revalidateActivities();
    return { success: "Atividade excluída." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir a atividade." };
  }
}

export async function createSubtaskAction(
  _previousState: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  try {
    await createSubtask(await requireActivityActor(), {
      activityId: formText(formData, "activityId"),
      title: formText(formData, "title"),
    });
    revalidateActivities();
    return { success: "Subtask criada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a subtask." };
  }
}

export async function updateSubtaskAction(
  _previousState: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  try {
    await updateSubtask(await requireActivityActor(), formText(formData, "subtaskId"), {
      title: formText(formData, "title"),
      completed: formData.get("completed") === "true",
    });
    revalidateActivities();
    return { success: "Subtask atualizada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar a subtask." };
  }
}

export async function deleteSubtaskAction(
  _previousState: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  try {
    await deleteSubtask(await requireActivityActor(), formText(formData, "subtaskId"));
    revalidateActivities();
    return { success: "Subtask excluída." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir a subtask." };
  }
}
