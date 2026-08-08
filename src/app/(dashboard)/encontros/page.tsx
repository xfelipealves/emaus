import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { getMeetingActor, listMeetingOptions, listMeetings } from "@/features/encontros/meeting-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { CreateMeetingForm } from "./meeting-forms";

export default async function MeetingsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) redirect("/login");
  const [{ categories, ministries }, meetings] = await Promise.all([listMeetingOptions(actor), listMeetings(actor)]);
  return <div className="mx-auto max-w-6xl"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#26766d]">Agenda</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Encontros</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Organize encontros e prepare o público da frequência.</p></div><Link href="/encontros/nova" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#26766d] px-4 py-2 text-sm font-semibold text-white">Novo encontro</Link></header><section className="mt-8 grid gap-4">{meetings.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhum encontro cadastrado.</p> : meetings.map((meeting) => <article key={meeting.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-950">{meeting.title}</h2><p className="mt-1 text-sm text-slate-500">{meeting.category.name} · {meeting.scheduledAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><p className="mt-2 text-sm text-slate-600">{meeting.audiences.length ? meeting.audiences.map((audience) => audience.ministry.name).join(", ") : "Toda a igreja"}</p></div><div className="grid justify-items-end gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{meeting.status === "DRAFT" ? "Rascunho" : meeting.status === "SCHEDULED" ? "Agendado" : "Cancelado"}</span>{meeting.status !== "CANCELLED" ? <Link href={`/encontros/${meeting.id}`} className="text-sm font-semibold text-[#26766d]">Abrir frequência</Link> : null}</div></div></article>)}</section><div className="sr-only">{categories.length} categorias disponíveis · {ministries.length} Ministérios disponíveis</div></div>;
}
