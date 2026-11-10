import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { KeyRound, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { db, schema } from "@/db";
import { canReuseConversation, isAiConfigured } from "@/server/ai/agent";
import { redirect } from "next/navigation";
import { TOOL_BY_NAME } from "@/server/ai/tools";
import { requireUser } from "@/server/session";
import { Chat, type ChatTurn } from "./chat";

export const metadata: Metadata = { title: "Assistente" };

type Stored = {
  role?: string;
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
  content?: unknown;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

/** Converte o histórico salvo (Anthropic, OpenAI Chat ou OpenAI Responses) em turnos para exibir. */
function toTurns(messages: Stored[], runs: { id: string; rating: number | null }[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const tools = new Map<string, Extract<ChatTurn["parts"][number], { kind: "tool" }>>();
  const addText = (turn: ChatTurn, text: string) => {
    const last = turn.parts[turn.parts.length - 1];
    if (last?.kind === "text") last.text += text;
    else turn.parts.push({ kind: "text", text });
  };
  const addTool = (turn: ChatTurn, id: string, name: string, input: unknown) => {
    const def = TOOL_BY_NAME.get(name);
    const part = { kind: "tool" as const, id, label: def?.label ?? name, write: def?.write ?? false, input, ok: null as boolean | null, error: undefined as string | undefined };
    tools.set(id, part);
    turn.parts.push(part);
  };
  const settle = (id: string, isError: boolean, content: unknown) => {
    const part = tools.get(id);
    if (!part) return;
    part.ok = !isError;
    if (isError && typeof content === "string") part.error = content.replace(/^Erro:\s*/, "");
  };

  for (const m of messages) {
    if (m.role === "user" && typeof m.content === "string") {
      const run = runs[turns.length];
      turns.push({ prompt: m.content, parts: [], runId: run?.id ?? null, rating: (run?.rating as 1 | -1 | null) ?? null });
      continue;
    }
    const turn = turns[turns.length - 1];
    if (!turn) continue;
    // OpenAI Responses: chamadas e resultados são itens próprios.
    if (m.type === "function_call" && m.call_id && m.name) {
      let input: unknown = {};
      try {
        input = JSON.parse(m.arguments || "{}");
      } catch {
        // argumentos inválidos: mostra o chip sem detalhes
      }
      addTool(turn, m.call_id, m.name, input);
      continue;
    }
    if (m.type === "function_call_output" && m.call_id) {
      settle(m.call_id, typeof m.output === "string" && m.output.startsWith("Erro:"), m.output);
      continue;
    }
    // OpenAI Chat: resultado de ferramenta em mensagem própria.
    if (m.role === "tool" && m.tool_call_id) {
      settle(m.tool_call_id, typeof m.content === "string" && m.content.startsWith("Erro:"), m.content);
      continue;
    }
    if (m.role === "assistant" && typeof m.content === "string" && m.content) addText(turn, m.content);
    for (const call of m.tool_calls ?? []) {
      let input: unknown = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        // argumentos inválidos: mostra o chip sem detalhes
      }
      addTool(turn, call.id, call.function.name, input);
    }
    // Anthropic: blocos de conteúdo.
    if (Array.isArray(m.content)) {
      for (const block of m.content as { type: string; [k: string]: unknown }[]) {
        if ((block.type === "text" || block.type === "output_text") && typeof block.text === "string" && block.text) addText(turn, block.text);
        else if (block.type === "tool_use") addTool(turn, block.id as string, block.name as string, block.input);
        else if (block.type === "tool_result") settle(block.tool_use_id as string, Boolean(block.is_error), block.content);
      }
    }
  }
  return turns;
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const user = await requireUser();
  const { c, q } = await searchParams;

  if (!(await isAiConfigured())) {
    return (
      <>
        <PageHeader title="Assistente" description="Pergunte em linguagem natural sobre pessoas, presença e agenda — e peça para ele fazer as tarefas." />
        <div className="max-w-xl rounded-2xl border bg-card p-6 shadow-xs">
          <KeyRound className="size-6 text-primary" />
          <h2 className="mt-3 font-display text-2xl">Falta ligar a IA</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {user.role === "admin" ? (
              <>
                Para usar de graça, crie uma chave em <a className="text-primary underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a> e
                defina <code className="rounded bg-muted px-1">GROQ_API_KEY</code> no <code className="rounded bg-muted px-1">.env</code> do servidor (ou{" "}
                <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> para usar o Claude). Depois reinicie o serviço.
              </>
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
    columns: { id: true, title: true, updatedAt: true, scopeKey: true },
    orderBy: desc(schema.aiConversation.updatedAt),
    limit: 50,
  });
  const reusable = conversations.filter((conv) => canReuseConversation(user, conv)).map(({ scopeKey: _s, ...conv }) => conv);
  const current = c
    ? await db.query.aiConversation.findFirst({
        where: and(eq(schema.aiConversation.id, c), eq(schema.aiConversation.userId, user.id)),
      })
    : null;
  // Conversa de quando o acesso era outro: o conteúdo pode ter dados que hoje não são dele.
  if (current && !canReuseConversation(user, current)) redirect("/assistente");
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
      conversations={reusable}
      conversationId={current?.id ?? null}
      initialTurns={current ? toTurns(current.messages as Stored[], runs) : []}
      initialPrompt={!current ? q : undefined}
      icon={<Sparkles className="size-5" />}
    />
  );
}
