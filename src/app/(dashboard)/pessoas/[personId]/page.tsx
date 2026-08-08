import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { getPersonProfile } from "@/features/pessoas/person-query";
import { formatDateInBrazil } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const statusLabels = { VISITOR: "Visitante", MEMBER: "Membro", INACTIVE: "Inativa" } as const;

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();
}

export default async function PersonProfilePage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account) notFound();

  const { personId } = await params;
  const person = await getPersonProfile({ id: account.id, role: account.role }, personId);
  if (!person) notFound();

  const canManage = account.role === "ADMINISTRATOR" || account.role === "SECRETARY";

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/pessoas" className="text-sm font-semibold text-[#26766d] hover:text-[#155e58]">← Voltar para Pessoas</Link>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {person.profilePhotoUrl ? (
              <img src={person.profilePhotoUrl} alt={`Foto de ${person.fullName}`} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span aria-label={`Iniciais de ${person.fullName}`} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#e3f1ed] text-xl font-semibold text-[#26766d]">{initials(person.fullName)}</span>
            )}
            <div>
              <p className="text-sm font-medium text-[#26766d]">Perfil da pessoa</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{person.fullName}</h1>
              <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{statusLabels[person.status]}</span>
            </div>
          </div>
          {canManage ? <Link href="/pessoas/nova" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cadastrar outra pessoa</Link> : null}
        </div>

        <dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-3">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Telefone</dt><dd className="mt-1 text-sm text-slate-700">{person.phone ?? "Não informado"}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nascimento</dt><dd className="mt-1 text-sm text-slate-700">{person.birthDate ? `${formatDateInBrazil(person.birthDate)}${person.age !== null ? ` · ${person.age} anos` : ""}` : "Não informado"}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Na comunidade desde</dt><dd className="mt-1 text-sm text-slate-700">{formatDateInBrazil(person.createdAt)}</dd></div>
        </dl>
      </section>

      <nav aria-label="Abas do perfil" className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200">
        <span aria-current="page" className="whitespace-nowrap border-b-2 border-[#26766d] px-3 py-3 text-sm font-semibold text-[#155e58]">Visão geral</span>
        <Link href={`/pessoas/${person.id}/timeline`} className="whitespace-nowrap px-3 py-3 text-sm font-medium text-[#26766d] hover:text-[#155e58]">Timeline</Link>
        <span className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-400">Ministérios</span>
        <span className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-400">Frequência</span>
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Ministérios</h2>
          {person.ministries.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum vínculo ministerial registrado.</p> : <ul className="mt-4 divide-y divide-slate-100">{person.ministries.map((ministry) => <li key={`${ministry.id}-${ministry.startDate.toISOString()}`} className="flex items-center justify-between gap-4 py-3 first:pt-0"><span className="font-medium text-slate-700">{ministry.name}</span><span className="text-right text-xs text-slate-500">{ministry.role === "LEADER" ? "Líder" : "Membro"}<br />{ministry.active ? "Vínculo atual" : `Até ${formatDateInBrazil(ministry.endDate!)}`}</span></li>)}</ul>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Frequência</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">O histórico de encontros desta pessoa aparecerá aqui.</p>
        </section>
      </div>
    </div>
  );
}
