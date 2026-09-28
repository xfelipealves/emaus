import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { getMinistryMembershipManagement } from "@/features/ministerios/membership-service";
import { formatDateOnly } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { CreateMembershipForm, EndMembershipForm, MembershipRoleForm } from "./membership-forms";

const roleLabels = { MEMBER: "Membro", LEADER: "Líder" } as const;
const personStatusLabels = { VISITOR: "Visitante", MEMBER: "Membro", INACTIVE: "Inativa" } as const;

export default async function MinistryMembershipManagementPage({
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
  const management = await getMinistryMembershipManagement({ id: account.id, role: account.role }, ministryId);
  if (!management) notFound();

  const { ministry, currentMemberships, historicMemberships } = management;
  const activePersonIds = currentMemberships.map((membership) => membership.personId);
  const endedMembershipId = query?.ended;
  const hasEndedMembership = typeof endedMembershipId === "string"
    && historicMemberships.some((membership) => membership.id === endedMembershipId);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/ministerios/${ministry.id}`} className="text-sm font-semibold text-[#26766d] hover:text-[#155e58]">← Voltar para Ministério</Link>
      <header className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-[#26766d]">Administração do Ministério</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Gerenciar vínculos</h1>
        <p className="mt-2 text-lg font-semibold text-slate-700">{ministry.name}</p>
        {ministry.status === "ARCHIVED" ? (
          <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Ministério arquivado. Os vínculos e seu histórico continuam disponíveis.</p>
        ) : null}
        <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vínculos atuais</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{currentMemberships.length}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Histórico de vínculos</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{historicMemberships.length}</dd></div>
        </dl>
      </header>

      {hasEndedMembership ? <p role="status" className="mt-5 rounded-xl bg-[#e3f1ed] px-4 py-3 text-sm text-[#155e58]">Vínculo encerrado com sucesso.</p> : null}

      {ministry.status === "ACTIVE" ? (
        <div className="mt-6">
          <CreateMembershipForm ministryId={ministry.id} people={management.people} activePersonIds={activePersonIds} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MembershipSection
          title="Vínculos atuais"
          memberships={currentMemberships}
          canChangeRole={ministry.status === "ACTIVE"}
        />
        <MembershipSection title="Histórico de vínculos" memberships={historicMemberships} historic />
      </div>
    </div>
  );
}

function MembershipSection({
  title,
  memberships,
  historic = false,
  canChangeRole = false,
}: {
  title: string;
  memberships: Array<{
    id: string;
    role: "MEMBER" | "LEADER";
    startDate: Date;
    endDate: Date | null;
    person: { id: string; fullName: string; status: keyof typeof personStatusLabels };
  }>;
  historic?: boolean;
  canChangeRole?: boolean;
}) {
  return (
    <section aria-label={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {memberships.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhum vínculo {historic ? "histórico" : "atual"} registrado.</p>
      ) : (
        <ul aria-label={title} className="mt-4 divide-y divide-slate-100">
          {memberships.map((membership) => (
            <li key={membership.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-4">
                <Link href={`/pessoas/${membership.person.id}`} className="min-w-0">
                  <span className="block truncate font-medium text-slate-700 hover:text-[#26766d]">{membership.person.fullName}</span>
                  <span className="mt-1 block text-xs text-slate-500">{personStatusLabels[membership.person.status]} · {roleLabels[membership.role]}</span>
                </Link>
                <span className="shrink-0 text-right text-xs text-slate-500">
                  {historic ? `De ${formatDateOnly(membership.startDate)} até ${formatDateOnly(membership.endDate!)}` : `Desde ${formatDateOnly(membership.startDate)}`}
                </span>
              </div>
              {!historic ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {canChangeRole ? <MembershipRoleForm membership={membership} /> : null}
                  <EndMembershipForm membership={membership} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
