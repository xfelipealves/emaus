import Link from "next/link";
import { APP_NAME } from "../app-identity";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#26766d]">Bom dia, Ana</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">A comunidade em um só lugar.</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">O cuidado começa aqui. Acompanhe a vida da comunidade e encontre o próximo passo da sua equipe.</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{APP_NAME} · visão geral</p>
      </section>

      <section aria-label="Atalhos rápidos" className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          ["Cadastrar pessoa", "Adicione um visitante ou membro", "/pessoas"],
          ["Criar encontro", "Organize a próxima reunião", "/encontros"],
          ["Lançar frequência", "Registre quem está presente", "/encontros"],
        ].map(([title, description, href]) => (
          <Link key={title} href={href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e3f1ed] text-lg text-[#26766d]">+</span>
            <h2 className="mt-5 font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Agenda</p>
              <h2 className="mt-2 text-xl font-semibold">Próximos encontros</h2>
            </div>
            <Link href="/encontros" className="text-sm font-semibold text-[#26766d]">Ver todos</Link>
          </div>
          <div className="mt-6 flex items-center gap-4 rounded-xl bg-[#f7f9f8] p-4">
            <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm"><p className="text-[10px] font-bold uppercase text-[#26766d]">AGO</p><p className="text-xl font-semibold">09</p></div>
            <div><p className="font-medium">Encontro de jovens</p><p className="mt-1 text-sm text-slate-500">Amanhã · 19:00 · Jovens</p></div>
          </div>
          <div className="mt-3 flex items-center gap-4 rounded-xl p-4"><div className="rounded-xl border border-slate-200 px-3 py-2 text-center"><p className="text-[10px] font-bold uppercase text-slate-400">AGO</p><p className="text-xl font-semibold">10</p></div><div><p className="font-medium">Celebração comunitária</p><p className="mt-1 text-sm text-slate-500">Domingo · 10:00 · Toda a igreja</p></div></div>
        </div>
        <div className="rounded-2xl bg-[#1e5d57] p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b7ded4]">Comunidade</p>
          <h2 className="mt-3 text-2xl font-semibold">Um retrato de hoje.</h2>
          <p className="mt-2 text-sm leading-6 text-[#d5ebe6]">Dados essenciais para você cuidar das pessoas com presença.</p>
          <div className="mt-8 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-semibold">248</p><p className="mt-1 text-xs text-[#b7ded4]">membros ativos</p></div><div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-semibold">12</p><p className="mt-1 text-xs text-[#b7ded4]">visitantes recentes</p></div></div>
        </div>
      </section>
    </div>
  );
}
