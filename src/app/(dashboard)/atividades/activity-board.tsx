"use client";

import { useActionState, type FormEvent } from "react";
import {
  createActivityAction,
  createSubtaskAction,
  deleteActivityAction,
  deleteSubtaskAction,
  updateActivityAction,
  updateSubtaskAction,
  type ActivityActionState,
} from "./actions";

export type ActivityView = {
  id: string;
  title: string;
  description: string | null;
  bucket: "TOMORROW" | "BACKLOG" | "PARKED";
  subtasks: Array<{ id: string; title: string; completed: boolean }>;
};

const bucketLabels = {
  TOMORROW: "Amanhã",
  BACKLOG: "Backlog",
  PARKED: "Estacionado",
} as const;

function ActionMessage({ state }: { state: ActivityActionState }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-[#fff1f1] px-3 py-2 text-xs text-[#b54747]">{state.error}</p>;
  if (state.success) return <p role="status" className="rounded-lg bg-[#e3f1ed] px-3 py-2 text-xs text-[#155e58]">{state.success}</p>;
  return null;
}

function CreateActivityForm() {
  const [state, formAction, isPending] = useActionState<ActivityActionState, FormData>(createActivityAction, {});

  return (
    <form action={formAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-semibold text-slate-950">Nova atividade</h2><p className="mt-1 text-sm text-slate-500">Registre o próximo passo da equipe.</p></div>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor="activity-title">Título da atividade<input id="activity-title" name="title" required placeholder="Ex.: confirmar escala de domingo" className="min-h-11 rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]" /></label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor="activity-description">Descrição <span className="font-normal text-slate-400">(opcional)</span><textarea id="activity-description" name="description" rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9]" /></label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor="activity-bucket">Área<select id="activity-bucket" name="bucket" defaultValue="TOMORROW" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-[#26766d]"><option value="TOMORROW">Amanhã</option><option value="BACKLOG">Backlog</option><option value="PARKED">Estacionado</option></select></label>
      <ActionMessage state={state} />
      <button type="submit" disabled={isPending} className="min-h-11 rounded-xl bg-[#26766d] px-4 text-sm font-semibold text-white hover:bg-[#1e5d57] disabled:opacity-60">{isPending ? "Criando..." : "Criar atividade"}</button>
    </form>
  );
}

function CreateSubtaskForm({ activityId, activityTitle }: { activityId: string; activityTitle: string }) {
  const [state, formAction, isPending] = useActionState<ActivityActionState, FormData>(createSubtaskAction, {});

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="activityId" value={activityId} />
      <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold text-slate-500" htmlFor={`new-subtask-${activityId}`}>Nova subtask<input id={`new-subtask-${activityId}`} name="title" required aria-label={`Nova subtask para ${activityTitle}`} placeholder="Adicionar subtarefa" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none focus:border-[#26766d]" /></label>
      <button type="submit" disabled={isPending} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{isPending ? "Adicionando..." : "Adicionar"}</button>
      <ActionMessage state={state} />
    </form>
  );
}

function SubtaskRow({ subtask }: { subtask: ActivityView["subtasks"][number] }) {
  const [updateState, updateAction, isUpdating] = useActionState<ActivityActionState, FormData>(updateSubtaskAction, {});
  const [deleteState, deleteAction, isDeleting] = useActionState<ActivityActionState, FormData>(deleteSubtaskAction, {});

  return (
    <li className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <form action={updateAction} className="contents">
        <input type="hidden" name="subtaskId" value={subtask.id} />
        <label className="flex items-center gap-2 text-sm text-slate-600" htmlFor={`subtask-completed-${subtask.id}`}>
          <input id={`subtask-completed-${subtask.id}`} name="completed" value="true" type="checkbox" defaultChecked={subtask.completed} className="h-4 w-4 accent-[#26766d]" />
          <span className="sr-only">Concluída: {subtask.title}</span>
        </label>
        <label className="sr-only" htmlFor={`subtask-title-${subtask.id}`}>Título da subtask: {subtask.title}</label>
        <input id={`subtask-title-${subtask.id}`} name="title" defaultValue={subtask.title} className={`min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#26766d] ${subtask.completed ? "text-slate-400 line-through" : "text-slate-700"}`} />
        <button type="submit" disabled={isUpdating} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60">{isUpdating ? "Salvando..." : "Salvar"}</button>
      </form>
      <form action={deleteAction} onSubmit={(event: FormEvent<HTMLFormElement>) => { if (!window.confirm(`Excluir a subtask ${subtask.title}?`)) event.preventDefault(); }} className="sm:col-start-3 sm:row-start-1">
        <input type="hidden" name="subtaskId" value={subtask.id} />
        <button type="submit" disabled={isDeleting} aria-label={`Excluir subtask ${subtask.title}`} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-[#963b3b] hover:bg-[#fff1f1] disabled:opacity-60">Excluir</button>
      </form>
      <div className="sm:col-span-3"><ActionMessage state={updateState} /><ActionMessage state={deleteState} /></div>
    </li>
  );
}

function ActivityCard({ activity }: { activity: ActivityView }) {
  const [updateState, updateAction, isUpdating] = useActionState<ActivityActionState, FormData>(updateActivityAction, {});
  const [deleteState, deleteAction, isDeleting] = useActionState<ActivityActionState, FormData>(deleteActivityAction, {});

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid={`activity-${activity.id}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{bucketLabels[activity.bucket]}</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{activity.title}</h2>{activity.description ? <p className="mt-1 text-sm leading-5 text-slate-500">{activity.description}</p> : null}</div>
        <form action={deleteAction} onSubmit={(event: FormEvent<HTMLFormElement>) => { if (!window.confirm(`Excluir a atividade ${activity.title}? As subtasks também serão excluídas.`)) event.preventDefault(); }}>
          <input type="hidden" name="activityId" value={activity.id} />
          <button type="submit" disabled={isDeleting} aria-label={`Excluir atividade ${activity.title}`} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#963b3b] hover:bg-[#fff1f1] disabled:opacity-60">{isDeleting ? "Excluindo..." : "Excluir"}</button>
        </form>
      </div>
      <form action={updateAction} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="activityId" value={activity.id} />
        <input type="hidden" name="title" value={activity.title} />
        <input type="hidden" name="description" value={activity.description ?? ""} />
        <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400" htmlFor={`activity-area-${activity.id}`}>Mover<select id={`activity-area-${activity.id}`} name="bucket" defaultValue={activity.bucket} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal normal-case tracking-normal text-slate-700"><option value="TOMORROW">Amanhã</option><option value="BACKLOG">Backlog</option><option value="PARKED">Estacionado</option></select></label>
        <button type="submit" disabled={isUpdating} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{isUpdating ? "Salvando..." : "Salvar área"}</button>
        <ActionMessage state={updateState} />
      </form>
      <section className="mt-5 border-t border-slate-100 pt-4" aria-label={`Subtasks de ${activity.title}`}>
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">Subtasks</h3><span className="text-xs text-slate-400">{activity.subtasks.filter((subtask) => subtask.completed).length}/{activity.subtasks.length}</span></div>
        {activity.subtasks.length ? <ul className="mt-3 grid gap-2">{activity.subtasks.map((subtask) => <SubtaskRow key={subtask.id} subtask={subtask} />)}</ul> : <p className="mt-3 text-sm text-slate-400">Nenhuma subtask ainda.</p>}
        <CreateSubtaskForm activityId={activity.id} activityTitle={activity.title} />
        <ActionMessage state={deleteState} />
      </section>
    </article>
  );
}

export function ActivityBoard({ activities }: { activities: ActivityView[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
      <CreateActivityForm />
      <section className="grid gap-4" aria-live="polite">
        {activities.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhuma atividade nesta visão.</p> : activities.map((activity) => <ActivityCard key={activity.id} activity={activity} />)}
      </section>
    </div>
  );
}
