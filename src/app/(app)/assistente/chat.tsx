"use client";

import { ArrowUp, Check, CircleAlert, History, Loader2, PenLine, Plus, Square, ThumbsDown, ThumbsUp, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "@/server/ai/agent";
import { deleteConversationAction, rateRunAction } from "./actions";

type ToolPart = { kind: "tool"; id: string; label: string; write: boolean; input: unknown; ok: boolean | null; error?: string };
type TextPart = { kind: "text"; text: string };
export type ChatTurn = {
  prompt: string;
  parts: (TextPart | ToolPart)[];
  runId: string | null;
  rating: 1 | -1 | null;
  error?: string;
  pending?: boolean;
};

type Conversation = { id: string; title: string; updatedAt: Date };

const SUGGESTIONS = [
  "Quem está sumido há mais de 3 semanas e ainda não tem acompanhamento?",
  "Como foi a frequência do Culto de Celebração nas últimas 4 semanas?",
  "Quem do New Mind faltou nos dois últimos sábados?",
  "Aniversariantes desta semana, com telefone",
  "Cria um acompanhamento para eu ligar para os visitantes que vieram só uma vez",
  "Resumo das anotações que falam de oração",
];

export function Chat({
  userName,
  isLeader,
  conversations,
  conversationId,
  initialTurns,
  initialPrompt,
  icon,
}: {
  userName: string;
  isLeader: boolean;
  conversations: Conversation[];
  conversationId: string | null;
  initialTurns: ChatTurn[];
  initialPrompt?: string;
  icon: React.ReactNode;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [history, setHistory] = useState(conversations);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const convId = useRef(conversationId);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const updateLast = (fn: (t: ChatTurn) => ChatTurn) =>
    setTurns((all) => [...all.slice(0, -1), fn(all[all.length - 1])]);

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setInput("");
    setBusy(true);
    setTurns((all) => [...all, { prompt, parts: [], runId: null, rating: null, pending: true }]);
    const controller = new AbortController();
    abort.current = controller;

    try {
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId.current, message: prompt }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Não foi possível falar com o assistente.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as AgentEvent);
      }
    } catch (err) {
      if (!controller.signal.aborted) updateLast((t) => ({ ...t, error: err instanceof Error ? err.message : "Erro inesperado." }));
    } finally {
      updateLast((t) => ({ ...t, pending: false }));
      setBusy(false);
      abort.current = null;
      textarea.current?.focus();
    }
  }

  function handle(event: AgentEvent) {
    switch (event.type) {
      case "conversation":
        if (!convId.current) {
          // Atualiza a URL sem recarregar: o estado local é a fonte durante a conversa.
          convId.current = event.id;
          window.history.replaceState(null, "", `/assistente?c=${event.id}`);
          setHistory((h) => [{ id: event.id, title: event.title, updatedAt: new Date() }, ...h]);
        }
        break;
      case "text":
        updateLast((t) => {
          const parts = [...t.parts];
          const last = parts[parts.length - 1];
          if (last?.kind === "text") parts[parts.length - 1] = { ...last, text: last.text + event.delta };
          else parts.push({ kind: "text", text: event.delta });
          return { ...t, parts };
        });
        break;
      case "tool":
        updateLast((t) => ({ ...t, parts: [...t.parts, { kind: "tool", id: event.id, label: event.label, write: event.write, input: event.input, ok: null }] }));
        break;
      case "tool_result":
        updateLast((t) => ({
          ...t,
          parts: t.parts.map((p) => (p.kind === "tool" && p.id === event.id ? { ...p, ok: event.ok, error: event.error } : p)),
        }));
        break;
      case "done":
        updateLast((t) => ({ ...t, runId: event.runId }));
        break;
      case "error":
        updateLast((t) => ({ ...t, error: event.message }));
        break;
    }
  }

  // Pergunta vinda da busca global (⌘K → "Perguntar ao assistente").
  useEffect(() => {
    if (initialPrompt && !autoSent.current) {
      autoSent.current = true;
      void send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  async function rate(index: number, value: 1 | -1) {
    const turn = turns[index];
    if (!turn.runId) return;
    const next = turn.rating === value ? null : value;
    setTurns((all) => all.map((t, i) => (i === index ? { ...t, rating: next } : t)));
    const r = await rateRunAction(turn.runId, next);
    if (!r.ok) toast.error(r.error);
  }

  return (
    <div className="-mt-2 flex min-h-[calc(100svh-9rem)] flex-col md:min-h-[calc(100svh-5rem)]">
      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">{icon}</span>
          <div>
            <h1 className="font-display text-3xl leading-none">Assistente</h1>
            <p className="mt-1 text-xs text-muted-foreground">Pergunte ou peça tarefas em português. Ele consulta e altera os dados com o seu acesso.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ConversationMenu conversations={history} current={convId.current} />
          <Button variant="outline" render={<Link href="/assistente" />} nativeButton={false}>
            <Plus data-icon="inline-start" /> <span className="hidden sm:inline">Nova conversa</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-8 pb-6">
        {turns.length === 0 ? (
          <div className="mx-auto max-w-2xl pt-6 text-center sm:pt-12">
            <h2 className="font-display text-4xl text-balance">
              Olá, {userName}. <span className="italic text-primary">Como posso ajudar?</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLeader ? "Consulto e atualizo as pessoas dos ministérios que você acompanha." : "Consulto e atualizo pessoas, presença, ministérios e agenda."}
            </p>
            <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border bg-card px-4 py-3 text-sm shadow-xs transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn, i) => <Turn key={i} turn={turn} onRate={(v) => rate(i, v)} />)
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-20 z-10 rounded-2xl border bg-card p-2 shadow-lg md:bottom-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textarea}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            autoFocus
            placeholder="Ex.: marca presença do Davi e da Giovanna no último Culto New Mind"
            aria-label="Mensagem para o assistente"
            className="max-h-44 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
          {busy ? (
            <Button type="button" size="icon-lg" variant="secondary" aria-label="Parar" onClick={() => abort.current?.abort()}>
              <Square className="size-4 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon-lg" aria-label="Enviar" disabled={!input.trim()}>
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Turn({ turn, onRate }: { turn: ChatTurn; onRate: (v: 1 | -1) => void }) {
  const hasText = turn.parts.some((p) => p.kind === "text" && p.text.trim());
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">{turn.prompt}</div>
      </div>
      <div className="space-y-2">
        {turn.parts.map((part, i) =>
          part.kind === "tool" ? (
            <ToolChip key={part.id} part={part} />
          ) : (
            <div key={i} className="prose-chat max-w-none text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
                {part.text}
              </ReactMarkdown>
            </div>
          ),
        )}
        {turn.pending && !hasText && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Pensando…
          </div>
        )}
        {turn.error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" /> {turn.error}
          </div>
        )}
        {!turn.pending && turn.runId && !turn.error && (
          <div className="flex gap-1 pt-1">
            <Button variant="ghost" size="icon-xs" aria-label="Resposta útil" onClick={() => onRate(1)} className={cn(turn.rating === 1 && "text-success")}>
              <ThumbsUp />
            </Button>
            <Button variant="ghost" size="icon-xs" aria-label="Resposta não ajudou" onClick={() => onRate(-1)} className={cn(turn.rating === -1 && "text-destructive")}>
              <ThumbsDown />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolChip({ part }: { part: ToolPart }) {
  const detail = summarizeInput(part.input);
  return (
    <div
      title={part.error}
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs",
        part.write ? "border-primary/30 bg-primary/6" : "bg-muted/50",
        part.ok === false && "border-destructive/40 bg-destructive/8 text-destructive",
      )}
    >
      {part.ok === null ? (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      ) : part.ok ? (
        part.write ? <PenLine className="size-3 shrink-0 text-primary" /> : <Check className="size-3 shrink-0 text-success" />
      ) : (
        <CircleAlert className="size-3 shrink-0" />
      )}
      <span className="font-medium">{part.label}</span>
      {detail && <span className="truncate text-muted-foreground">{detail}</span>}
      {part.ok === false && part.error && <span className="truncate">— {part.error}</span>}
    </div>
  );
}

/** Mostra só o essencial do que a IA pediu (ex.: o texto buscado), sem ids. */
function summarizeInput(input: unknown) {
  if (!input || typeof input !== "object") return "";
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([k, v]) => !k.endsWith("_id") && !k.endsWith("_ids") && v !== undefined && v !== "" && typeof v !== "object")
    .map(([, v]) => String(v));
  return entries.join(" · ").slice(0, 80);
}

const MD: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  a: ({ href, children }) =>
    href?.startsWith("/") ? (
      <Link href={href} className="font-medium text-primary underline-offset-2 hover:underline">
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
        {children}
      </a>
    ),
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  h1: ({ children }) => <h3 className="mt-4 mb-2 font-display text-xl">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 mb-2 font-display text-xl">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1 font-semibold">{children}</h4>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50 text-left text-xs text-muted-foreground">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-t px-3 py-2">{children}</td>,
};

function ConversationMenu({ conversations, current }: { conversations: Conversation[]; current: string | null }) {
  const router = useRouter();
  if (!conversations.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" aria-label="Conversas anteriores" />}>
        <History data-icon="inline-start" /> <span className="hidden sm:inline">Histórico</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        {conversations.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => router.push(`/assistente?c=${c.id}`)} className={cn("group", c.id === current && "bg-accent")}>
            <Wand2 className="text-muted-foreground" />
            <span className="flex-1 truncate">{c.title}</span>
            <button
              type="button"
              aria-label="Apagar conversa"
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
              onClick={async (e) => {
                e.stopPropagation();
                const r = await deleteConversationAction(c.id);
                if (r.ok) router.push(c.id === current ? "/assistente" : "/assistente" + (current ? `?c=${current}` : ""));
                router.refresh();
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
