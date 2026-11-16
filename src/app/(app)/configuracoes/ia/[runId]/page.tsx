import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, CircleAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { usd } from "@/components/app/ai-panels";
import { Section } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/tone";
import { db, schema } from "@/db";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TOOL_BY_NAME } from "@/server/ai/tools";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Execução da IA" };

/** Trace de uma pergunta: cada chamada ao modelo e a ferramentas, em ordem, com tempo e custo. */
export default async function AiRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const user = await requireUser();
  const run = await db.query.aiRun.findFirst({
    where: and(eq(schema.aiRun.id, runId), eq(schema.aiRun.churchId, user.churchId)),
    with: { user: { columns: { name: true } }, steps: { orderBy: asc(schema.aiStep.seq) } },
  });
  if (!run) notFound();
  const settings = await getSettings(user.churchId);
  const longest = Math.max(1, ...run.steps.map((s) => s.latencyMs));

  return (
    <div className="space-y-4">
      <Link href="/configuracoes/ia" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> IA
      </Link>
      <Section
        title="Pergunta"
        description={`${formatDateTime(run.createdAt, settings.timezone)} · ${run.user?.name ?? "—"} · ${run.model}`}
      >
        <div className="space-y-3 px-5 pb-5 text-sm">
          <p className="font-medium">{run.prompt}</p>
          {run.answer && <p className="whitespace-pre-wrap text-muted-foreground">{run.answer}</p>}
          <div className="flex flex-wrap gap-2">
            <ToneBadge tone="slate">{(run.latencyMs / 1000).toFixed(1)}s</ToneBadge>
            <ToneBadge tone="gold">{usd(run.costUsd)}</ToneBadge>
            <ToneBadge tone="sky">
              {(run.inputTokens + run.cacheReadTokens + run.cacheWriteTokens).toLocaleString("pt-BR")} tokens de entrada ·{" "}
              {run.cacheReadTokens.toLocaleString("pt-BR")} do cache
            </ToneBadge>
            {run.rating === 1 && (
              <ToneBadge tone="sage">
                <ThumbsUp className="size-3" /> útil
              </ToneBadge>
            )}
            {run.rating === -1 && (
              <ToneBadge tone="rose">
                <ThumbsDown className="size-3" /> não ajudou
              </ToneBadge>
            )}
          </div>
          {run.ratingNote && <p className="text-destructive">“{run.ratingNote}”</p>}
          {run.error && (
            <p className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
              <CircleAlert className="size-4 shrink-0" /> {run.error}
            </p>
          )}
        </div>
      </Section>

      <Section title="Passos" description="Na ordem em que aconteceram; a barra mostra o tempo de cada passo">
        <ol className="divide-y border-t">
          {run.steps.map((s) => (
            <li key={s.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
              <span className={cn("min-w-0 truncate", !s.ok && "text-destructive")}>
                <span className="text-xs text-muted-foreground">{s.kind === "model" ? "Modelo" : "Ferramenta"} · </span>
                {s.kind === "tool" ? (TOOL_BY_NAME.get(s.name)?.label ?? s.name) : s.name}
                {s.write && <span className="ml-1.5 text-xs text-primary">escrita</span>}
              </span>
              <span className="text-right text-xs tabular text-muted-foreground">
                {(s.latencyMs / 1000).toFixed(2)}s
                {s.kind === "model" &&
                  ` · ${(s.inputTokens + s.cacheReadTokens + s.cacheWriteTokens).toLocaleString("pt-BR")} in (${s.cacheReadTokens.toLocaleString("pt-BR")} cache) / ${s.outputTokens.toLocaleString("pt-BR")} out · ${usd(s.costUsd)}`}
              </span>
              <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", s.ok ? (s.kind === "model" ? "bg-primary" : "bg-sky-500") : "bg-destructive")}
                  style={{ width: `${Math.max(1, (s.latencyMs / longest) * 100)}%` }}
                />
              </div>
              {s.error && <span className="col-span-2 text-xs text-destructive">{s.error}</span>}
            </li>
          ))}
          {run.steps.length === 0 && (
            <li className="px-5 py-4 text-sm text-muted-foreground">Sem passos registrados (execução anterior ao trace).</li>
          )}
        </ol>
      </Section>
    </div>
  );
}
