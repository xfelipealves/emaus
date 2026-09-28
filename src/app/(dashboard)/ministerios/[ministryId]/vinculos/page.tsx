import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { getMinistryMembershipManagement } from "@/features/ministerios/membership-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import {
  CreateMembershipForm,
  MembershipEndForm,
  MembershipHistoryItem,
  MembershipRoleForm,
} from "./membership-forms";

const statusLabels = { VISITOR: "Visitante", MEMBER: "Membro", INACTIVE: "Inativa" } as const;

export default async function MinistryMembershipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ ministryId: string }>;
  searchParams?: Promise<{ ended?: string }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account || account.role !== "ADMINISTRATOR") notFound();

  const { ministryId } = await params;
  const query = await searchParams;
  const data = await getMinistryMembershipManagement({ id: account.id, role: account.role }, ministryId);
  if (!data) notFound();
  const activePersonIds = data.currentMemberships.map((membership) => membership.personId);
  const didEndMembership = typeof query?.ended === "string"
    && data.historicMemberships.some((membership) => membership.id === query.ended);

  return <div className="mx-auto max-w-5xl">
    <Link href={`/ministerios/${data.ministry.id}`} className="text-sm font-semibold text-[#26766d] hover:text-[#155e58]">← Voltar para {data.ministry.name}</Link>
    <header className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <p className="text-sm font-medium text-[#26766d]">Histórico ministerial</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Vínculos de {data.ministry.name}</h1>
          <p className="mt-2 text-sm text-slate-500">Entradas, mudanças de cargo e saídas permanecem no histórico da Pessoa e do Ministério.</p>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${data.ministry.status === "ACTIVE" ? "bg-[#e3f1ed] text-[#155e58]" : "bg-slate-100 text-slate-500"}`}>
          {data.ministry.status === "ACTIVE" ? "Ativo" : "Arquivado"}
        </span>
      </div>
      <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vínculos atuais</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{data.currentMemberships.length}</dd></div>
        <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vínculos encerrados</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{data.historicMemberships.length}</dd></div>
      </dl>
    </header>

    {didEndMembership ? <p role="status" className="mt-5 rounded-xl bg-[#e3f1ed] px-4 py-3 text-sm text-[#155e58]">Vínculo encerrado com sucesso.</p> : null}

    {data.ministry.status === "ACTIVE"
      ? <div className="mt-6"><CreateMembershipForm ministryId={data.ministry.id} people={data.people} activePersonIds={activePersonIds} /></div>
      : <p role="status" className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">Este Ministério está arquivado. O histórico pode ser consultado e os vínculos atuais podem ser encerrados.</p>}

    <section aria-label="Vínculos atuais" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">Vínculos atuais</h2>
      {data.currentMemberships.length === 0
        ? <p className="mt-4 text-sm text-slate-500">Nenhum vínculo atual.</p>
        : <ul className="mt-4 divide-y divide-slate-100">
          {data.currentMemberships.map((membership) => <li key={membership.id} className="py-4 first:pt-0 last:pb-0">
            <MembershipHistoryItem
              personId={membership.person.id}
              personName={`${membership.person.fullName} · ${statusLabels[membership.person.status]}`}
              role={membership.role}
              startDate={membership.startDate}
            />
            {data.ministry.status === "ACTIVE"
              ? <MembershipRoleForm ministryId={data.ministry.id} membership={membership} personName={membership.person.fullName} />
              : null}
            <MembershipEndForm ministryId={data.ministry.id} membership={membership} personName={membership.person.fullName} />
          </li>)}
        </ul>}
    </section>

    <section aria-label="Histórico de vínculos" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">Histórico de vínculos</h2>
      {data.historicMemberships.length === 0
        ? <p className="mt-4 text-sm text-slate-500">Nenhum vínculo encerrado.</p>
        : <ul className="mt-4 divide-y divide-slate-100">
          {data.historicMemberships.map((membership) => <MembershipHistoryItem
            key={membership.id}
            personId={membership.person.id}
            personName={`${membership.person.fullName} · ${statusLabels[membership.person.status]}`}
            role={membership.role}
            startDate={membership.startDate}
            endDate={membership.endDate}
          />)}
        </ul>}
    </section>
  </div>;
}
