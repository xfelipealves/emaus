import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

// Sem "server-only": lib/auth.ts usa isto e também roda no seed (tsx).
/** Conta uma tentativa na chave exata. Também usado pelo login do better-auth. */
export async function consumeRateLimit(id: string, limit: number, windowMs: number) {
  const now = Date.now();
  const [row] = await db
    .insert(schema.rateLimit)
    .values({ key: id, count: 1, resetAt: now + windowMs })
    .onConflictDoUpdate({
      target: schema.rateLimit.key,
      set: {
        count: sql`case when ${schema.rateLimit.resetAt} < ${now} then 1 else ${schema.rateLimit.count} + 1 end`,
        resetAt: sql`case when ${schema.rateLimit.resetAt} < ${now} then ${now + windowMs} else ${schema.rateLimit.resetAt} end`,
      },
    })
    .returning({ count: schema.rateLimit.count, resetAt: schema.rateLimit.resetAt });
  // Limpeza oportunista de chaves vencidas.
  if (Math.random() < 0.02) await db.delete(schema.rateLimit).where(sql`${schema.rateLimit.resetAt} < ${now}`);
  return { allowed: row.count <= limit, retryAfterMs: Math.max(0, row.resetAt - now) };
}
