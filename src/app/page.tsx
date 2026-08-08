import { APP_NAME } from "./app-identity";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">{APP_NAME}</p>
        <h1 className="text-3xl font-semibold tracking-tight">A comunidade em um só lugar.</h1>
        <p className="mt-4 text-slate-600">A base do aplicativo está pronta para receber os próximos fluxos.</p>
      </section>
    </main>
  );
}
