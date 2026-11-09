import type { AttendanceStatus } from "@prisma/client";
import type { FrequencyReportPeriodResult, MinistryFrequencySummary } from "./frequency-report";

const attendanceLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Presentes",
  ABSENT: "Ausentes",
  NOT_CONFIRMED: "Não confirmados",
};

export function FrequencyReportView({
  from,
  to,
  period,
  summaries = [],
}: {
  from: string;
  to: string;
  period: FrequencyReportPeriodResult;
  summaries?: MinistryFrequencySummary[];
}) {
  const hasCounts = summaries.some(({ totals }) => Object.values(totals).some((count) => count > 0));

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <p className="text-sm font-medium text-[#26766d]">Ministérios</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Resumo de frequência</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Consulte presentes, ausentes e não confirmados por Ministério em um período.</p>
      </header>

      <form method="get" action="/ministerios/frequencia" className="mt-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="frequency-from">
          Data inicial
          <input id="frequency-from" name="from" type="date" defaultValue={from} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor="frequency-to">
          Data final
          <input id="frequency-to" name="to" type="date" defaultValue={to} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]" />
        </label>
        <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#26766d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#155e58]">
          Aplicar período
        </button>
      </form>

      <section className="mt-6" aria-live="polite">
        {period.kind === "incomplete" ? <p role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Escolha a data inicial e a data final para consultar a frequência.</p> : null}
        {period.kind === "invalid" ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-4 py-3 text-sm text-[#b54747]">{period.message}</p> : null}
        {period.kind === "valid" && summaries.length === 0 ? <p role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Nenhum Ministério disponível para seu perfil.</p> : null}
        {period.kind === "valid" && summaries.length > 0 && !hasCounts ? <p role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Nenhuma frequência encontrada neste período.</p> : null}
        {period.kind === "valid" && summaries.length > 0 ? <div className="grid gap-4 lg:grid-cols-2">{summaries.map((summary) => <article key={summary.ministryId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-950">{summary.ministryName}</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {(["PRESENT", "ABSENT", "NOT_CONFIRMED"] as const).map((status) => <div key={status} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs font-medium text-slate-500">{attendanceLabels[status]}</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary.totals[status]}</dd>
            </div>)}
          </dl>
        </article>)}</div> : null}
      </section>
    </div>
  );
}
