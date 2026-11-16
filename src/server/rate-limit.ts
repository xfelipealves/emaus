import "server-only";
import { headers } from "next/headers";
import { consumeRateLimit } from "./rate-limit-store";

/**
 * Limite por janela guardado no banco: vale entre instâncias da Vercel e cold starts.
 * Incremento atômico em um único upsert.
 */
export async function rateLimit(key: string, limit = 15, windowMs = 60_000) {
  const h = await headers();
  // Na Vercel, x-forwarded-for vem do proxy da plataforma; o primeiro IP é o do cliente.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const id = key.includes(":") ? key : `${key}:${ip}`;
  return (await consumeRateLimit(id, limit, windowMs)).allowed;
}
