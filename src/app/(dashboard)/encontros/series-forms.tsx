"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { formatDateOnly } from "@/lib/dates";
import {
  createSeriesAction,
  generateSeriesOccurrencesAction,
  updateSeriesAction,
  type SeriesActionState,
} from "./actions";

type Option = { id: string; name: string };

type ManagedSeries = {
  id: string;
  name: string;
  categoryId: string;
  recurrence: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  weekdays: number[];
  startDate: Date;
  endDate: Date | null;
  ministryIds: string[];
  category: Option;
  audiences: Array<{ ministryId: string; ministry: { name: string; status: "ACTIVE" | "ARCHIVED" } }>;
  _count: { meetings: number };
};

const weekdayOptions = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const recurrenceLabels = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
} as const;

function RecurringSeriesFields({ categories, ministries, series }: {
  categories: Option[];
  ministries: Option[];
  series?: ManagedSeries;
}) {
  const [wholeChurch, setWholeChurch] = useState(!series || series.ministryIds.length === 0);
  const prefix = series ? `series-${series.id}` : "new-series";
  const activeMinistryIds = new Set(ministries.map((ministry) => ministry.id));
  const archivedAudiences = series?.audiences.filter((audience) => !activeMinistryIds.has(audience.ministryId)) ?? [];
  const [recurrence, setRecurrence] = useState(series?.recurrence ?? "WEEKLY");

  return (
    <>
      {series ? <input type="hidden" name="seriesId" value={series.id} /> : null}
      <Input id={`${prefix}-name`} name="name" label="Nome da série" defaultValue={series?.name ?? ""} required />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`${prefix}-category`}>
        Categoria
        <select id={`${prefix}-category`} name="categoryId" defaultValue={series?.categoryId ?? ""} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]">
          <option value="" disabled>Selecione uma categoria</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`${prefix}-recurrence`}>
        Recorrência
        <select id={`${prefix}-recurrence`} name="recurrence" value={recurrence} onChange={(event) => setRecurrence(event.currentTarget.value as ManagedSeries["recurrence"])} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]">
          <option value="WEEKLY">Semanal</option>
          <option value="BIWEEKLY">Quinzenal</option>
          <option value="MONTHLY">Mensal</option>
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-700">Dias da semana</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {weekdayOptions.map((day) => <label key={day.value} className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="weekdays" value={day.value} defaultChecked={series?.weekdays.includes(day.value)} />{day.label}
          </label>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`${prefix}-start`}>
          Data inicial
          <input id={`${prefix}-start`} name="startDate" type="date" defaultValue={series ? formatDateOnly(series.startDate) : ""} required className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`${prefix}-end`}>
          Data final <span className="font-normal text-slate-400">(opcional)</span>
          <input id={`${prefix}-end`} name="endDate" type="date" defaultValue={series?.endDate ? formatDateOnly(series.endDate) : ""} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]" />
        </label>
      </div>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium text-slate-700">Público das novas ocorrências</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="audience" value="whole-church" defaultChecked={wholeChurch} onChange={() => setWholeChurch(true)} />Toda a igreja</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="audience" value="ministries" defaultChecked={!wholeChurch} onChange={() => setWholeChurch(false)} />Ministérios selecionados</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {ministries.map((ministry) => <label key={ministry.id} className={`flex items-center gap-2 text-sm ${wholeChurch ? "text-slate-400" : "text-slate-600"}`}>
            <input type="checkbox" name="ministryIds" value={ministry.id} defaultChecked={series?.ministryIds.includes(ministry.id)} disabled={wholeChurch} />{ministry.name}
          </label>)}
          {archivedAudiences.map((audience) => <label key={audience.ministryId} className={`flex items-center gap-2 text-sm ${wholeChurch ? "text-slate-400" : "text-slate-600"}`}>
            <input type="checkbox" name="ministryIds" value={audience.ministryId} defaultChecked disabled={wholeChurch} />{audience.ministry.name} (arquivado)
          </label>)}
        </div>
      </fieldset>
      {recurrence === "MONTHLY" ? <p className="text-xs leading-5 text-slate-500">Mensal repete os dias selecionados na mesma posição ordinal do início (por exemplo, na primeira semana do mês); meses sem essa posição são pulados.</p> : null}
    </>
  );
}

export function CreateSeriesForm({ categories, ministries }: { categories: Option[]; ministries: Option[] }) {
  const [state, formAction, isPending] = useActionState<SeriesActionState, FormData>(createSeriesAction, {});

  return (
    <form action={formAction} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-semibold">Nova série recorrente</h2><p className="mt-1 text-sm text-slate-500">Defina a regra e depois escolha até quando gerar encontros individuais.</p></div>
      <RecurringSeriesFields categories={categories} ministries={ministries} />
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" disabled={isPending || categories.length === 0}>{isPending ? "Criando..." : "Criar série"}</Button>
    </form>
  );
}

export function EditSeriesForm({ categories, ministries, series }: { categories: Option[]; ministries: Option[]; series: ManagedSeries }) {
  const [state, formAction, isPending] = useActionState<SeriesActionState, FormData>(updateSeriesAction, {});

  return (
    <form action={formAction} className="grid gap-4 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-500">{series._count.meetings} encontro(s) gerado(s) até agora. Alterações afetam novas ocorrências; as existentes permanecem independentes.</p>
      <RecurringSeriesFields categories={categories} ministries={ministries} series={series} />
      {state.error ? <p role="alert" className="rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
      <Button type="submit" variant="secondary" disabled={isPending || categories.length === 0}>{isPending ? "Salvando..." : "Salvar série"}</Button>
    </form>
  );
}

export function GenerateSeriesOccurrencesForm({ seriesId, seriesName }: { seriesId: string; seriesName: string }) {
  const [state, formAction, isPending] = useActionState<SeriesActionState, FormData>(generateSeriesOccurrencesAction, {});

  return (
    <form action={formAction} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <input type="hidden" name="seriesId" value={seriesId} />
      <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={`through-${seriesId}`}>
        Gerar encontros até <span className="font-normal text-slate-500">— {seriesName}</span>
        <input id={`through-${seriesId}`} name="throughDate" type="date" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-[#26766d]" />
      </label>
      <Button type="submit" variant="secondary" disabled={isPending}>{isPending ? "Gerando..." : "Gerar encontros"}</Button>
      {state.error ? <p role="alert" className="sm:col-span-2 rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#b54747]">{state.error}</p> : null}
      {state.success ? <p role="status" className="sm:col-span-2 rounded-xl bg-[#e3f1ed] px-3 py-2 text-sm text-[#155e58]">{state.success}</p> : null}
    </form>
  );
}

export function SeriesAudienceSummary({ series }: { series: ManagedSeries }) {
  return <p className="mt-2 text-sm text-slate-600">{series.audiences.length ? series.audiences.map((audience) => audience.ministry.name).join(", ") : "Toda a igreja"}</p>;
}

export { recurrenceLabels };
