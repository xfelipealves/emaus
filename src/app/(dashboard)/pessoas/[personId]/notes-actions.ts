"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { archiveNote, createNote, updateNote } from "@/features/timeline/note-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export type NoteActionState = { error?: string; success?: string };

async function requireSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account) throw new Error("Sua sessão expirou. Entre novamente.");
  return account;
}

export async function saveNoteAction(
  _previousState: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const personId = String(formData.get("personId") ?? "");
  try {
    const actor = await requireSession();
    const content = String(formData.get("content") ?? "");
    const noteId = String(formData.get("noteId") ?? "");
    if (noteId) {
      await updateNote({ id: actor.id, role: actor.role }, noteId, content);
    } else {
      await createNote({ id: actor.id, role: actor.role }, personId, content);
    }
    revalidatePath(`/pessoas/${personId}`);
    return { success: noteId ? "Nota atualizada." : "Nota adicionada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar a nota." };
  }
}

export async function archiveNoteAction(
  _previousState: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const personId = String(formData.get("personId") ?? "");
  try {
    const actor = await requireSession();
    await archiveNote({ id: actor.id, role: actor.role }, String(formData.get("noteId") ?? ""));
    revalidatePath(`/pessoas/${personId}`);
    return { success: "Nota arquivada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível arquivar a nota." };
  }
}
