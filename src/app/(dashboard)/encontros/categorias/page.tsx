import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { listCategories } from "@/features/encontros/category-service";
import { getMeetingActor } from "@/features/encontros/meeting-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { CreateCategoryForm, EditCategoryForm } from "../category-forms";

export default async function MeetingCategoriesPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) redirect("/login");
  if (actor.role !== "ADMINISTRATOR") redirect("/encontros");

  const categories = await listCategories(actor);

  return <div className="mx-auto max-w-6xl">
    <Link href="/encontros" className="text-sm font-semibold text-[#26766d]">← Encontros</Link>
    <header className="mt-5">
      <p className="text-sm font-medium text-[#26766d]">Agenda</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Categorias de encontros</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Crie e edite categorias usadas nos encontros. Categorias em uso permanecem no histórico.</p>
    </header>
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <CreateCategoryForm />
      <section className="grid content-start gap-4" aria-label="Categorias cadastradas">
        <h2 className="text-lg font-semibold text-slate-950">Categorias cadastradas</h2>
        {categories.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Nenhuma categoria cadastrada.</p> : categories.map((category) => <article key={category.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">{category.name}</h3>
          <EditCategoryForm category={category} />
        </article>)}
      </section>
    </div>
  </div>;
}
