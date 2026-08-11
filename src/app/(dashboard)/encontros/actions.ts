"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/session-service";
import { createMeeting, getMeetingActor } from "@/features/encontros/meeting-service";
import { parseDateTimeInput } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

async function requireMeetingActor() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) throw new Error("Sessão inválida.");
  return actor;
}

export type MeetingActionState = { error?: string; success?: string };

export async function createMeetingAction(_previousState: MeetingActionState, formData: FormData): Promise<MeetingActionState> {
  try {
    const wholeChurch = formData.get("audience") === "whole-church";
    await createMeeting(await requireMeetingActor(), {
      categoryId: String(formData.get("categoryId") ?? ""),
      title: String(formData.get("title") ?? ""),
      scheduledAt: parseDateTimeInput(String(formData.get("scheduledAt") ?? "")),
      status: String(formData.get("status") ?? "DRAFT") as "DRAFT" | "SCHEDULED" | "CANCELLED",
      wholeChurch,
      ministryIds: formData.getAll("ministryIds").map(String),
    });
    revalidatePath("/encontros");
    return { success: "Encontro criado com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o encontro." };
  }
}
