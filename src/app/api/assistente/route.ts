import { z } from "zod";
import { type AgentEvent, isAiConfigured, runAgent } from "@/server/ai/agent";
import { rateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

const body = z.object({
  conversationId: z.string().nullable().optional(),
  message: z.string().trim().min(1).max(4000),
});

/** Conversa com o assistente: responde em NDJSON (um evento por linha) enquanto o agente trabalha. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Não autenticado", { status: 401 });
  if (!(await isAiConfigured())) return Response.json({ error: "IA não configurada" }, { status: 503 });
  if (!(await rateLimit(`ai:${user.id}`, 20))) {
    return Response.json({ error: "Muitas perguntas seguidas. Aguarde um minuto." }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await runAgent({
          user,
          conversationId: parsed.data.conversationId ?? null,
          prompt: parsed.data.message,
          emit,
          signal: request.signal,
        });
      } catch (err) {
        console.error("[assistente]", err);
        emit({ type: "error", message: err instanceof Error ? err.message : "Falha no assistente." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
