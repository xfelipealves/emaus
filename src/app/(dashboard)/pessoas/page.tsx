import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { getSession } from "@/features/auth/session-service";
import { searchPeople, type PersonListFilter } from "@/features/pessoas/person-query";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { formatDateInBrazil } from "@/lib/dates";

const filters: Array<{ value: PersonListFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "visitor", label: "Visitantes" },
  { value: "member", label: "Membros" },
  { value: "inactive", label: "Inativas" },
];

const statusLabels = { VISITOR: "Visitante", MEMBER: "Membro", INACTIVE: "Inativa" } as const;

function isPersonListFilter(value: string | undefined): value is PersonListFilter {
  return filters.some((filter) => filter.value === value);
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account) redirect("/login");

  const params = await searchParams;
  const status = isPersonListFilter(params.status) ? params.status : "all";
  const search = params.q?.trim() ?? "";
  const people = await searchPeople({ id: account.id, role: account.role }, { search, status });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#26766d]">Comunidade</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Pessoas</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Encontre uma pessoa e acompanhe sua caminhada com a comunidade.</p>
        </div>
        <Link href="/pessoas/nova" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#26766d] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#1e5d57]">Cadastrar pessoa</Link>
      </header>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <form className="flex flex-col gap-3 sm:flex-row" role="search">
          <label className="sr-only" htmlFor="people-search">Buscar por nome</label>
          <input id="people-search" name="q" defaultValue={search} placeholder="Buscar por nome" className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]" />
          <input type="hidden" name="status" value={status} />
          <button type="submit" className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Buscar</button>
        </form>
        <nav aria-label="Filtrar pessoas" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => {
            const href = new URLSearchParams({ ...(search ? { q: search } : {}), status: filter.value }).toString();
            return <Link key={filter.value} href={`/pessoas?${href}`} aria-current={status === filter.value ? "page" : undefined} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${status === filter.value ? "bg-[#dceee9] text-[#155e58]" : "text-slate-500 hover:bg-slate-100"}`}>{filter.label}</Link>;
          })}
        </nav>
      </section>

      <section className="mt-6" aria-live="polite">
        {people.length === 0 ? (
          <EmptyState title="Nenhuma pessoa encontrada" description="Tente outro nome ou mude o filtro para ampliar sua busca." action={<Link href="/pessoas/nova" className="text-sm font-semibold text-[#26766d]">Cadastrar pessoa</Link>} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {people.map((person) => (
                <li key={person.id}>
                  <Link href={`/pessoas/${person.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 sm:px-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e3f1ed] text-sm font-semibold text-[#26766d]">{person.fullName.split(/\s+/).slice(0, 2).map((name) => name[0]).join("").toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{person.fullName}</span><span className="mt-1 block text-sm text-slate-500">{person.phone ?? "Sem telefone"}{person.age !== null ? ` · ${person.age} anos` : ""}</span></span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{statusLabels[person.status]}{person.birthDate && person.age === null ? ` · ${formatDateInBrazil(person.birthDate)}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
