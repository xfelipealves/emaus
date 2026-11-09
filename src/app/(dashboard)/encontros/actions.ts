"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/session-service";
import { createCategory, updateCategory } from "@/features/encontros/category-service";
import { createMeeting, getMeetingActor } from "@/features/encontros/meeting-service";
import { createSeries, generateSeriesOccurrences, updateSeries, type SeriesInput } from "@/features/encontros/series-service";
import { parseDateInput, parseDateTimeInput } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { RecurrencePattern } from "@prisma/client";

async function requireMeetingActor() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) throw new Error("Sessão inválida.");
  return actor;
}

export type MeetingActionState = { error?: string; success?: string };
export type CategoryActionState = { error?: string; success?: string };
export type SeriesActionState = { error?: string; success?: string };

function categoryInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

function seriesInput(formData: FormData): SeriesInput {
  const recurrenceValue = String(formData.get("recurrence") ?? "");
  const recurrencePatterns: RecurrencePattern[] = ["WEEKLY", "BIWEEKLY", "MONTHLY"];
  if (!recurrencePatterns.includes(recurrenceValue as RecurrencePattern)) {
    throw new Error("Selecione um padrão de recorrência válido.");
  }

  const ministryIds = formData.get("audience") === "whole-church"
    ? []
    : formData.getAll("ministryIds").map(String);

  return {
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("name") ?? ""),
    recurrence: recurrenceValue as RecurrencePattern,
    weekdays: formData.getAll("weekdays").map((value) => Number(value)),
    startDate: parseDateInput(String(formData.get("startDate") ?? "")),
    endDate: String(formData.get("endDate") ?? "").trim()
      ? parseDateInput(String(formData.get("endDate")))
      : undefined,
    ministryIds,
  };
}

function revalidateSeriesAdministration() {
  revalidatePath("/encontros");
  revalidatePath("/encontros/nova");
  revalidatePath("/encontros/series");
  revalidatePath("/ministerios/frequencia");
}

export async function createCategoryAction(_previousState: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  try {
    await createCategory(await requireMeetingActor(), categoryInput(formData));
    revalidatePath("/encontros");
    revalidatePath("/encontros/nova");
    revalidatePath("/encontros/categorias");
    revalidatePath("/encontros/series");
    return { success: "Categoria criada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a categoria." };
  }
}

export async function updateCategoryAction(_previousState: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  try {
    await updateCategory(await requireMeetingActor(), String(formData.get("categoryId") ?? ""), categoryInput(formData));
    revalidatePath("/encontros");
    revalidatePath("/encontros/nova");
    revalidatePath("/encontros/categorias");
    revalidatePath("/encontros/series");
    return { success: "Categoria atualizada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar a categoria." };
  }
}

export async function createSeriesAction(_previousState: SeriesActionState, formData: FormData): Promise<SeriesActionState> {
  try {
    await createSeries(await requireMeetingActor(), seriesInput(formData));
    revalidateSeriesAdministration();
    return { success: "Série recorrente criada com sucesso." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a série recorrente." };
  }
}

export async function updateSeriesAction(_previousState: SeriesActionState, formData: FormData): Promise<SeriesActionState> {
  try {
    await updateSeries(await requireMeetingActor(), String(formData.get("seriesId") ?? ""), seriesInput(formData));
    revalidateSeriesAdministration();
    return { success: "Série recorrente atualizada. Ocorrências existentes continuam independentes." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar a série recorrente." };
  }
}

export async function generateSeriesOccurrencesAction(_previousState: SeriesActionState, formData: FormData): Promise<SeriesActionState> {
  try {
    const throughDate = parseDateInput(String(formData.get("throughDate") ?? ""));
    const occurrences = await generateSeriesOccurrences(
      await requireMeetingActor(),
      String(formData.get("seriesId") ?? ""),
      throughDate,
    );
    revalidateSeriesAdministration();
    return { success: `${occurrences.length} encontro(s) da série estão disponíveis até ${String(formData.get("throughDate"))}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível gerar os encontros." };
  }
}

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
