import { todayIso } from "@/lib/dates";
import { evalCases } from "@/server/ai/insights";
import { getCurrentUser } from "@/server/session";
import { getSettings } from "@/server/settings";

/** Casos de avaliação em JSONL (uma pergunta por linha) para testar mudanças no assistente. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Não autenticado", { status: 401 });
  if (user.role !== "admin") return new Response("Sem permissão", { status: 403 });
  const nota = new URL(request.url).searchParams.get("nota");
  const rating = nota === "ruim" ? -1 : nota === "boa" ? 1 : null;
  const cases = await evalCases(user.churchId, rating);
  const settings = await getSettings(user.churchId);
  const body = cases.map((c) => JSON.stringify(c)).join("\n") + (cases.length ? "\n" : "");
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="emaus-avaliacoes-${todayIso(settings.timezone)}.jsonl"`,
      "Cache-Control": "no-store",
    },
  });
}
