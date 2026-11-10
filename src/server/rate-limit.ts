import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "@/db";

/**
 * Limite por janela guardado no banco: vale entre instâncias da Vercel e cold starts.
 * Incremento atômico em um único upsert.
 */
export async function rateLimit(key: string, limit = 15, windowMs = 60_000) {
  const h = await headers();
  // Na Vercel, x-forwarded-for vem do proxy da plataforma; o primeiro IP é o do cliente.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const id = key.includes(":") ? key : `${key}:${ip}`;
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
    .returning({ count: schema.rateLimit.count });
  // Limpeza oportunista de chaves vencidas.
  if (Math.random() < 0.02) await db.delete(schema.rateLimit).where(sql`${schema.rateLimit.resetAt} < ${now}`);
  return row.count <= limit;
}
