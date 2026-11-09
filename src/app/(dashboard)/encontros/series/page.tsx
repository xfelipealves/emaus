import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { getMeetingActor, listMeetingOptions } from "@/features/encontros/meeting-service";
import { listSeries } from "@/features/encontros/series-service";
import { formatDateOnly } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { CreateSeriesForm, EditSeriesForm, GenerateSeriesOccurrencesForm, SeriesAudienceSummary, recurrenceLabels } from "../series-forms";

const weekdayLabels: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  7: "Domingo",
};

export default async function MeetingSeriesPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) redirect("/login");
  if (actor.role !== "ADMINISTRATOR") redirect("/encontros");

  const [{ categories, ministries }, savedSeries] = await Promise.all([
    listMeetingOptions(actor),
    listSeries(actor),
  ]);
  const series = savedSeries.map((item) => ({
    ...item,
    ministryIds: item.audiences.map((audience) => audience.ministryId),
  }));

  return <div className="mx-auto max-w-6xl">
    <Link href="/encontros" className="text-sm font-semibold text-[#26766d]">← Encontros</Link>
    <header className="mt-5">
      <p className="text-sm font-medium text-[#26766d]">Agenda</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Séries recorrentes</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Configure a regra, escolha o público e gere encontros individuais. Repetir a geração até o mesmo horizonte não duplica encontros já criados.</p>
    </header>
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <CreateSeriesForm categories={categories} ministries={ministries} />
      <section className="grid content-start gap-4" aria-label="Séries cadastradas">
        <h2 className="text-lg font-semibold text-slate-950">Séries cadastradas</h2>
        {series.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Nenhuma série recorrente cadastrada.</p> : series.map((item) => <article key={item.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="font-semibold text-slate-950">{item.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{item.category.name} · {recurrenceLabels[item.recurrence]} · {formatDateOnly(item.startDate)} até {item.endDate ? formatDateOnly(item.endDate) : "sem término"}</p>
            <p className="mt-1 text-sm text-slate-500">{item.weekdays.map((weekday) => weekdayLabels[weekday] ?? "Dia inválido").join(", ")}</p>
            <SeriesAudienceSummary series={item} />
          </div>
          <EditSeriesForm categories={categories} ministries={ministries} series={item} />
          <GenerateSeriesOccurrencesForm seriesId={item.id} seriesName={item.name} />
        </article>)}
      </section>
    </div>
  </div>;
}
