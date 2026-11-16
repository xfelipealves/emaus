import { z } from "zod";
import { isDemoMode } from "@/lib/demo";
import { type AgentEvent, isAiConfigured, runAgent } from "@/server/ai/agent";
import { rateLimit } from "@/server/rate-limit";
import { getCurrentUser } from "@/server/session";

const body = z.object({
  conversationId: z.string().nullable().optional(),
  message: z.string().trim().min(1).max(4000),
});

// Respostas com várias ferramentas podem levar mais que o limite padrão de funções serverless.
export const maxDuration = 300;

/** Conversa com o assistente: responde em NDJSON (um evento por linha) enquanto o agente trabalha. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Não autenticado", { status: 401 });
  if (!(await isAiConfigured(user.churchId))) return Response.json({ error: "IA não configurada" }, { status: 503 });
  // Por visitante (chaves sem ":" ganham o IP) e um teto global de custo por dia.
  if (isDemoMode() && (
    !(await rateLimit("demo-ai-minute", 3)) ||
    !(await rateLimit("demo-ai-day", 20, 86_400_000)) ||
    !(await rateLimit("demo:ai:day", 100, 86_400_000))
  )) {
    return Response.json({ error: "Limite da demonstração atingido. Tente novamente mais tarde." }, { status: 429 });
  }
  if (!(await rateLimit(`ai:${user.id}`, 20))) {
    return Response.json({ error: "Muitas perguntas seguidas. Aguarde um minuto." }, { status: 429 });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida" }, { status: 400 });

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      // Cliente fechou a aba ou clicou em parar: enqueue lançaria e o agente não salvaria o histórico.
      const emit = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
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
        if (!closed) controller.close();
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
