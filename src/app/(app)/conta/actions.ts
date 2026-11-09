"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import { runAction } from "@/server/action";
import { recordAudit } from "@/server/history";
import { ActionError, getCurrentUser } from "@/server/session";
import { passwordRule } from "@/server/users";

export async function changeOwnPasswordAction(currentPassword: string, newPassword: string) {
  return runAction(async () => {
    // getCurrentUser: no primeiro acesso requireUser redirecionaria para cá mesmo.
    const user = await getCurrentUser();
    if (!user) throw new ActionError("Sessão expirada. Entre novamente.");
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
    await db.update(schema.user).set({ mustChangePassword: false }).where(eq(schema.user.id, user.id));
    await recordAudit(db, {
      actorId: user.id,
      entity: "user",
      entityId: user.id,
      action: "password.change",
      summary: `${user.name} trocou a própria senha`,
    });
  }, "Senha alterada");
}
