import { AppShell } from "../components/layout/app-shell";

export const homePageTitle = "Emaús";

export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#477462]">Bom dia, equipe</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-5xl">Cuide das pessoas, uma história por vez.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Um espaço sereno para acompanhar a vida da comunidade e manter cada encontro no lugar certo.</p>
        </div>

        <section aria-label="Resumo da comunidade" className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-[#184d3c] p-6 text-white md:col-span-2">
            <p className="text-sm text-emerald-100">Próximo passo</p>
            <h2 className="mt-8 text-2xl font-semibold tracking-tight">Comece pelo que precisa de atenção hoje.</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-emerald-50/80">Use a navegação para encontrar pessoas, organizar ministérios ou preparar um encontro.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Acesso rápido</p>
            <p className="mt-8 text-2xl font-semibold tracking-tight text-slate-950">Pessoas</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Cadastre ou encontre alguém da comunidade.</p>
            <a className="mt-6 inline-flex text-sm font-semibold text-[#184d3c] underline decoration-[#a8c8b8] underline-offset-4" href="/pessoas">Ver pessoas</a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
