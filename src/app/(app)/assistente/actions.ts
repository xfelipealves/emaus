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
      .set({ rating })
      .where(and(eq(schema.aiRun.id, runId), eq(schema.aiRun.userId, user.id)));
  });
}

export async function deleteConversationAction(id: string) {
  return runAction(async () => {
    const user = await requireUser();
    await db
      .delete(schema.aiConversation)
      .where(and(eq(schema.aiConversation.id, id), eq(schema.aiConversation.userId, user.id)));
  }, "Conversa apagada");
}
