import type { Metadata } from "next";
import { ToneBadge } from "@/components/app/tone";
import { formatDateTime } from "@/lib/dates";
import { getSettings } from "@/server/settings";
import { listAudit } from "@/server/users";

export const metadata: Metadata = { title: "Auditoria" };

const ENTITY: Record<string, { label: string; tone: string }> = {
  attendance: { label: "Presença", tone: "sky" },
  person: { label: "Pessoa", tone: "ember" },
  user: { label: "Conta", tone: "plum" },
  ministry: { label: "Ministério", tone: "sage" },
  event: { label: "Encontro", tone: "gold" },
  series: { label: "Série", tone: "gold" },
  settings: { label: "Igreja", tone: "slate" },
};

export default async function AuditPage() {
  const [entries, settings] = await Promise.all([listAudit(300), getSettings()]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Correções de presença, mudanças de status, contas e exclusões. Os 300 registros mais recentes.</p>
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
        {entries.map((e) => {
          const meta = ENTITY[e.entity] ?? { label: e.entity, tone: "slate" };
          return (
            <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <time className="w-36 shrink-0 text-xs text-muted-foreground tabular">{formatDateTime(e.createdAt, settings.timezone)}</time>
              <ToneBadge tone={meta.tone} className="w-fit">{meta.label}</ToneBadge>
              <span className="min-w-0 flex-1 text-sm">{e.summary}</span>
              <span className="text-xs text-muted-foreground">{e.actor?.name ?? "Check-in público"}</span>
            </li>
          );
        })}
        {entries.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum registro ainda.</li>}
      </ol>
    </div>
  );
}
