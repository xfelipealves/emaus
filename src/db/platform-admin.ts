/**
 * Cria (ou renova a senha de) uma conta de operador da plataforma, sem igreja:
 * entra direto em /plataforma. A senha é gerada e mostrada uma única vez.
 *
 *   npm run platform:admin -- <usuario> [email]
 */
import "./load-env";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db, schema } from "./index";

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new Error("Uso: npm run platform:admin -- <usuario> [email]");
  }
  const email = (process.argv[3] ?? `${username}@plataforma.emaus.local`).toLowerCase();
  const password = randomBytes(18).toString("base64url");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  const existing = await db.query.user.findFirst({ where: eq(schema.user.username, username) });
  if (existing) {
    await db.update(schema.user).set({ platformAdmin: true, active: true, mustChangePassword: false }).where(eq(schema.user.id, existing.id));
    await ctx.internalAdapter.updatePassword(existing.id, hash);
    await db.delete(schema.session).where(eq(schema.session.userId, existing.id));
    console.log(`Conta ${username} agora opera a plataforma; senha renovada e sessões encerradas.`);
  } else {
    const user = await ctx.internalAdapter.createUser(
      { name: "Operação Emaús", email, username, displayUsername: username, role: "admin", active: true, platformAdmin: true },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: hash });
    console.log(`Conta de plataforma ${username} criada.`);
  }
  console.log(`Senha (guarde agora, não será mostrada de novo): ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
