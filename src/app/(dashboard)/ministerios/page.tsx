import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { listMinistries } from "@/features/ministerios/ministry-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ArchiveMinistryForm, CreateMinistryForm, EditMinistryForm } from "./ministry-forms";

export default async function MinistriesPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  if (!account) redirect("/login");

  const actor = { id: account.id, role: account.role, ministryAccess: [] } as const;
  const ministries = await listMinistries(actor);
  const isAdministrator = account.role === "ADMINISTRATOR";

  return (
    <div className="mx-auto max-w-6xl">
      <header><p className="text-sm font-medium text-[#26766d]">Estrutura</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Ministérios</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Acompanhe as frentes de serviço e mantenha seus dados organizados.</p><Link href="/ministerios/frequencia" className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-[#26766d] px-4 py-2 text-sm font-semibold text-[#26766d] hover:bg-[#e3f1ed]">Resumo de frequência</Link></header>
      {isAdministrator ? <div className="mt-8"><CreateMinistryForm /></div> : null}
      <section className="mt-8" aria-live="polite">
        {ministries.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhum Ministério cadastrado.</div> : <div className="grid gap-4 lg:grid-cols-2">{ministries.map((ministry) => <article key={ministry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-950"><Link href={`/ministerios/${ministry.id}`} className="hover:text-[#26766d]">{ministry.name}</Link></h2><p className="mt-1 text-sm text-slate-500">{ministry.description ?? "Sem descrição"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ministry.status === "ACTIVE" ? "bg-[#e3f1ed] text-[#155e58]" : "bg-slate-100 text-slate-500"}`}>{ministry.status === "ACTIVE" ? "Ativo" : "Arquivado"}</span></div>{isAdministrator ? <div className="mt-5"><EditMinistryForm ministry={ministry} />{ministry.status === "ACTIVE" ? <ArchiveMinistryForm ministryId={ministry.id} ministryName={ministry.name} /> : null}</div> : null}</article>)}</div>}
      </section>
    </div>
  );
}
