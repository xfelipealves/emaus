import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { listAuditEvents } from "@/features/auditoria/audit-query";
import { formatDateInBrazil } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

function formatPayload(value: unknown) {
  return value === null ? "Não registrado" : JSON.stringify(value, null, 2);
}

export default async function AuditPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || account.role !== "ADMINISTRATOR") redirect("/");

  const events = await listAuditEvents(account);

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <p className="text-sm font-medium text-[#26766d]">Configurações</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Ações sensíveis registradas com autoria, horário e estado dos dados.</p>
      </header>

      <section aria-label="Registros de auditoria" className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {events.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Nenhum registro de auditoria encontrado.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => (
              <article key={event.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#26766d]">{event.action}</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">{event.targetType} · {event.targetId}</h2>
                    <p className="mt-1 text-sm text-slate-500">Autor: {event.actor?.person.fullName ?? "Conta removida"}</p>
                  </div>
                  <time dateTime={event.createdAt.toISOString()} className="shrink-0 text-xs text-slate-500">{formatDateInBrazil(event.createdAt)}</time>
                </div>
                {event.reason ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>Motivo:</strong> {event.reason}</p> : null}
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Antes</h3>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{formatPayload(event.before)}</pre>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Depois</h3>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">{formatPayload(event.after)}</pre>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
