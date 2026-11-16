"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { runAction } from "@/server/action";
import { ActionError, requireUser } from "@/server/session";

export async function rateRunAction(runId: string, rating: 1 | -1 | null) {
  return runAction(async () => {
    const user = await requireUser();
    if (rating !== null && rating !== 1 && rating !== -1) throw new ActionError("Avaliação inválida.");
    await db
      .update(schema.aiRun)
      // Nova avaliação reabre a revisão; tirar o 👎 também tira o comentário.
      .set({ rating, reviewedAt: null, ...(rating === -1 ? {} : { ratingNote: null }) })
      .where(and(eq(schema.aiRun.id, runId), eq(schema.aiRun.userId, user.id), eq(schema.aiRun.churchId, user.churchId)));
  });
}

export async function rateRunNoteAction(runId: string, note: string) {
  return runAction(async () => {
    const user = await requireUser();
    const text = note.trim().slice(0, 500);
    if (!text) throw new ActionError("Escreva o comentário.");
    await db
      .update(schema.aiRun)
      .set({ ratingNote: text })
      .where(and(eq(schema.aiRun.id, runId), eq(schema.aiRun.userId, user.id), eq(schema.aiRun.churchId, user.churchId), eq(schema.aiRun.rating, -1)));
  });
}

export async function deleteConversationAction(id: string) {
  return runAction(async () => {
    const user = await requireUser();
    await db
      .delete(schema.aiConversation)
      .where(and(eq(schema.aiConversation.id, id), eq(schema.aiConversation.userId, user.id), eq(schema.aiConversation.churchId, user.churchId)));
  }, "Conversa apagada");
}
