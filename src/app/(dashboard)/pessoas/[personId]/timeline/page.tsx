import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { getPersonProfile } from "@/features/pessoas/person-query";
import { getPersonTimeline, type TimelineFilter } from "@/features/timeline/timeline-query";
import { formatDateInBrazil } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const filters: Array<{ value: TimelineFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "status", label: "Status" },
  { value: "ministries", label: "Ministérios" },
  { value: "attendance", label: "Frequência" },
  { value: "notes", label: "Notas" },
  { value: "corrections", label: "Correções" },
];

const categoryLabels = {
  REGISTRATION: "Cadastro",
  STATUS: "Status",
  MINISTRY: "Ministério",
  ATTENDANCE: "Frequência",
  NOTE: "Nota",
  CORRECTION: "Correção",
} as const;

function parseFilter(value: string | undefined): TimelineFilter {
  return filters.some((filter) => filter.value === value) ? (value as TimelineFilter) : "all";
}

export default async function PersonTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account) notFound();

  const { personId } = await params;
  const person = await getPersonProfile({ id: account.id, role: account.role }, personId);
  if (!person) notFound();

  const filter = parseFilter((await searchParams).filter);
  const events = await getPersonTimeline({ id: account.id, role: account.role }, personId, filter);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/pessoas/${personId}`} className="text-sm font-semibold text-[#26766d] hover:text-[#155e58]">← Voltar para o perfil</Link>
      <header className="mt-6">
        <p className="text-sm font-medium text-[#26766d]">Histórico da pessoa</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Timeline de {person.fullName}</h1>
        <p className="mt-2 text-sm text-slate-500">Eventos em ordem do mais recente para o mais antigo.</p>
      </header>

      <nav aria-label="Filtros da timeline" className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <Link
            key={item.value}
            href={item.value === "all" ? `/pessoas/${personId}/timeline` : `/pessoas/${personId}/timeline?filter=${item.value}`}
            aria-current={filter === item.value ? "page" : undefined}
            className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold ${filter === item.value ? "border-[#26766d] bg-[#e3f1ed] text-[#155e58]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section aria-label="Eventos da timeline" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum evento encontrado para este filtro.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {events.map((event) => (
              <li key={event.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#26766d]">{categoryLabels[event.category]}</p>
                    <h2 className="mt-1 font-semibold text-slate-900">{event.title}</h2>
                    {event.description ? <p className="mt-1 text-sm text-slate-600">{event.description}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">Pessoa: {person.fullName} · Por: {event.actor?.fullName ?? "Sistema"}</p>
                  </div>
                  <time dateTime={event.occurredAt.toISOString()} className="shrink-0 text-xs text-slate-500">{formatDateInBrazil(event.occurredAt)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
