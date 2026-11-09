import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { KeyRound, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { db, schema } from "@/db";
import { isAiConfigured } from "@/server/ai/agent";
import { TOOL_BY_NAME } from "@/server/ai/tools";
import { requireUser } from "@/server/session";
import { Chat, type ChatTurn } from "./chat";

export const metadata: Metadata = { title: "Assistente" };

/** Converte o histórico salvo (formato da API) em turnos para exibir. */
function toTurns(messages: Anthropic.Beta.BetaMessageParam[], runs: { id: string; rating: number | null }[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const toolIndex = new Map<string, { ok: boolean | null; error?: string }>();
  for (const m of messages) {
    if (m.role === "user" && typeof m.content === "string") {
      const run = runs[turns.length];
      turns.push({ prompt: m.content, parts: [], runId: run?.id ?? null, rating: (run?.rating as 1 | -1 | null) ?? null });
      continue;
    }
    const turn = turns[turns.length - 1];
    if (!turn || !m.content || typeof m.content === "string") continue;
    for (const block of m.content) {
      if (block.type === "text" && block.text) {
        const last = turn.parts[turn.parts.length - 1];
        if (last?.kind === "text") last.text += block.text;
        else turn.parts.push({ kind: "text", text: block.text });
      } else if (block.type === "tool_use") {
        const def = TOOL_BY_NAME.get(block.name);
        const part = { kind: "tool" as const, id: block.id, label: def?.label ?? block.name, write: def?.write ?? false, input: block.input, ok: null as boolean | null, error: undefined as string | undefined };
        toolIndex.set(block.id, part);
        turn.parts.push(part);
      } else if (block.type === "tool_result") {
        const part = toolIndex.get(block.tool_use_id);
        if (part) {
          part.ok = !block.is_error;
          if (block.is_error && typeof block.content === "string") part.error = block.content;
        }
      }
    }
  }
  return turns;
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const user = await requireUser();
  const { c, q } = await searchParams;

  if (!isAiConfigured()) {
    return (
      <>
        <PageHeader title="Assistente" description="Pergunte em linguagem natural sobre pessoas, presença e agenda — e peça para ele fazer as tarefas." />
        <div className="max-w-xl rounded-2xl border bg-card p-6 shadow-xs">
          <KeyRound className="size-6 text-primary" />
          <h2 className="mt-3 font-display text-2xl">Falta ligar a IA</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {user.role === "admin" ? (
              <>Defina <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> no arquivo <code className="rounded bg-muted px-1">.env</code> do servidor e reinicie o serviço.</>
            ) : (
              "Peça a um administrador para configurar o assistente."
            )}
          </p>
        </div>
      </>
    );
  }

  const conversations = await db.query.aiConversation.findMany({
    where: eq(schema.aiConversation.userId, user.id),
    columns: { id: true, title: true, updatedAt: true },
    orderBy: desc(schema.aiConversation.updatedAt),
    limit: 50,
  });
  const current = c
    ? await db.query.aiConversation.findFirst({
        where: and(eq(schema.aiConversation.id, c), eq(schema.aiConversation.userId, user.id)),
      })
    : null;
  const runs = current
    ? await db
        .select({ id: schema.aiRun.id, rating: schema.aiRun.rating })
        .from(schema.aiRun)
        .where(and(eq(schema.aiRun.conversationId, current.id), isNull(schema.aiRun.error)))
        .orderBy(asc(schema.aiRun.createdAt))
    : [];

  return (
    <Chat
      key={current?.id ?? "new"}
      userName={user.name.split(" ")[0]}
      isLeader={user.role === "leader"}
      conversations={conversations}
      conversationId={current?.id ?? null}
      initialTurns={current ? toTurns(current.messages as Anthropic.Beta.BetaMessageParam[], runs) : []}
      initialPrompt={!current ? q : undefined}
      icon={<Sparkles className="size-5" />}
    />
  );
}
