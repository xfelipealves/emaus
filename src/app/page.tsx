export const homePageTitle = "Emaús";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Fundação local</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{homePageTitle}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">A base do sistema está pronta para receber os próximos fluxos do MVP.</p>
      </section>
    </main>
  );
}
