import "server-only";
import { headers } from "next/headers";

/** URL pública do app, respeitando proxy reverso (ex.: tailscale serve). */
export async function publicBaseUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
}
