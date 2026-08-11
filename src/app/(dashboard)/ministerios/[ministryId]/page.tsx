import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { getMinistryProfile } from "@/features/ministerios/ministry-service";
import { formatDateInBrazil, formatDateOnly } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const personStatusLabels = { VISITOR: "Visitante", MEMBER: "Membro", INACTIVE: "Inativa" } as const;

export default async function MinistryProfilePage({ params }: { params: Promise<{ ministryId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account) notFound();

  const { ministryId } = await params;
  const ministry = await getMinistryProfile({ id: account.id, role: account.role }, ministryId);
  if (!ministry) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/ministerios" className="text-sm font-semibold text-[#26766d] hover:text-[#155e58]">← Voltar para Ministérios</Link>
      <header className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm font-medium text-[#26766d]">Perfil do Ministério</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{ministry.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{ministry.description ?? "Sem descrição"}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ministry.status === "ACTIVE" ? "bg-[#e3f1ed] text-[#155e58]" : "bg-slate-100 text-slate-500"}`}>{ministry.status === "ACTIVE" ? "Ativo" : "Arquivado"}</span>
        </div>
        <dl className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Participantes atuais</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{ministry.currentParticipants.length}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Histórico</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{ministry.historicParticipants.length}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Próximos encontros</dt><dd className="mt-1 text-2xl font-semibold text-slate-950">{ministry.meetings.length}</dd></div></dl>
      </header>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><ParticipantSection title="Participantes atuais" participants={ministry.currentParticipants} /><ParticipantSection title="Histórico de participantes" participants={ministry.historicParticipants} historic /></div>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-950">Próximos encontros</h2>{ministry.meetings.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum encontro agendado para este Ministério.</p> : <ul className="mt-4 divide-y divide-slate-100">{ministry.meetings.map((meeting) => <li key={meeting.id} className="flex items-center justify-between gap-4 py-3 first:pt-0"><span><span className="block font-medium text-slate-700">{meeting.title}</span><span className="mt-1 block text-sm text-slate-500">{meeting.category.name}</span></span><span className="shrink-0 text-right text-sm text-slate-500">{formatDateInBrazil(meeting.scheduledAt)}</span></li>)}</ul>}</section>
    </div>
  );
}

function ParticipantSection({ title, participants, historic = false }: { title: string; participants: Array<{ person: { id: string; fullName: string; status: keyof typeof personStatusLabels }; role: "MEMBER" | "LEADER"; startDate: Date; endDate: Date | null }>; historic?: boolean }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-950">{title}</h2>{participants.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhuma pessoa nesta categoria.</p> : <ul className="mt-4 divide-y divide-slate-100">{participants.map((membership) => <li key={`${membership.person.id}-${membership.startDate.toISOString()}`} className="flex items-center justify-between gap-4 py-3 first:pt-0"><Link href={`/pessoas/${membership.person.id}`} className="min-w-0"><span className="block truncate font-medium text-slate-700 hover:text-[#26766d]">{membership.person.fullName}</span><span className="mt-1 block text-xs text-slate-500">{personStatusLabels[membership.person.status]} · {membership.role === "LEADER" ? "Líder" : "Membro"}</span></Link><span className="shrink-0 text-right text-xs text-slate-500">{historic ? `Até ${formatDateOnly(membership.endDate!)}` : `Desde ${formatDateOnly(membership.startDate)}`}</span></li>)}</ul>}</section>;
}
