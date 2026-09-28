"use client";

import { Archive, CheckCircle, Clock, ListChecks, Plus, Trash } from "@phosphor-icons/react";
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

const bucketIcons = {
  TOMORROW: Clock,
  BACKLOG: ListChecks,
  PARKED: Archive,
} as const;

function ActionMessage({ state }: { state: ActivityActionState }) {
  if (state.error) return <p role="alert" className="status-message status-message--error">{state.error}</p>;
  if (state.success) return <p role="status" className="status-message status-message--success">{state.success}</p>;
  return null;
}

function CreateActivityForm() {
  const [state, formAction, isPending] = useActionState<ActivityActionState, FormData>(createActivityAction, {});

  return (
    <form action={formAction} className="activity-form">
      <div className="activity-form__heading">
        <div>
          <h2 className="activity-form__title">Nova atividade</h2>
          <p className="activity-form__description">Registre o próximo passo da equipe.</p>
        </div>
        <span className="activity-form__icon"><Plus size={19} weight="bold" aria-hidden="true" /></span>
      </div>
      <label className="field-label" htmlFor="activity-title">
        Título da atividade
        <input id="activity-title" name="title" required placeholder="Ex.: confirmar escala de domingo" className="field-control min-h-11 w-full" />
      </label>
      <label className="field-label" htmlFor="activity-description">
        Descrição <span className="font-normal normal-case tracking-normal opacity-75">(opcional)</span>
        <textarea id="activity-description" name="description" rows={3} className="field-control min-h-20 w-full resize-y" />
      </label>
      <label className="field-label" htmlFor="activity-bucket">
        Área
        <select id="activity-bucket" name="bucket" defaultValue="TOMORROW" className="field-control min-h-11 w-full">
          <option value="TOMORROW">Amanhã</option>
          <option value="BACKLOG">Backlog</option>
          <option value="PARKED">Estacionado</option>
        </select>
      </label>
      <ActionMessage state={state} />
      <button type="submit" disabled={isPending} className="button-primary w-full">
        <Plus size={16} weight="bold" aria-hidden="true" />
        {isPending ? "Criando..." : "Criar atividade"}
      </button>
    </form>
  );
}

function CreateSubtaskForm({ activityId, activityTitle }: { activityId: string; activityTitle: string }) {
  const [state, formAction, isPending] = useActionState<ActivityActionState, FormData>(createSubtaskAction, {});

  return (
    <form action={formAction} className="subtask-create">
      <input type="hidden" name="activityId" value={activityId} />
      <label className="field-label subtask-create__field" htmlFor={`new-subtask-${activityId}`}>
        Nova subtask
        <input id={`new-subtask-${activityId}`} name="title" required aria-label={`Nova subtask para ${activityTitle}`} placeholder="Adicionar subtarefa" className="field-control min-h-10 w-full" />
      </label>
      <button type="submit" disabled={isPending} className="button-secondary">
        <Plus size={15} weight="bold" aria-hidden="true" />
        {isPending ? "Adicionando..." : "Adicionar"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function SubtaskRow({ subtask }: { subtask: ActivityView["subtasks"][number] }) {
  const [updateState, updateAction, isUpdating] = useActionState<ActivityActionState, FormData>(updateSubtaskAction, {});
  const [deleteState, deleteAction, isDeleting] = useActionState<ActivityActionState, FormData>(deleteSubtaskAction, {});

  return (
    <li className="subtask-row">
      <form action={updateAction} className="contents">
        <input type="hidden" name="subtaskId" value={subtask.id} />
        <label className="grid place-items-center" htmlFor={`subtask-completed-${subtask.id}`}>
          <input id={`subtask-completed-${subtask.id}`} name="completed" value="true" type="checkbox" defaultChecked={subtask.completed} />
          <span className="sr-only">Concluída: {subtask.title}</span>
        </label>
        <label className="sr-only" htmlFor={`subtask-title-${subtask.id}`}>Título da subtask: {subtask.title}</label>
        <input id={`subtask-title-${subtask.id}`} name="title" type="text" defaultValue={subtask.title} className={subtask.completed ? "opacity-60 line-through" : ""} />
        <button type="submit" disabled={isUpdating} className="button-secondary min-h-9 px-2.5 text-xs">{isUpdating ? "Salvando..." : "Salvar"}</button>
      </form>
      <form action={deleteAction} onSubmit={(event: FormEvent<HTMLFormElement>) => { if (!window.confirm(`Excluir a subtask ${subtask.title}?`)) event.preventDefault(); }} className="col-start-3 row-start-1">
        <input type="hidden" name="subtaskId" value={subtask.id} />
        <button type="submit" disabled={isDeleting} aria-label={`Excluir subtask ${subtask.title}`} className="button-danger min-h-9 px-2.5 text-xs">
          <Trash size={15} weight="regular" aria-hidden="true" />
          <span className="hidden sm:inline">Excluir</span>
        </button>
      </form>
      <div className="col-span-3"><ActionMessage state={updateState} /><ActionMessage state={deleteState} /></div>
    </li>
  );
}

function ActivityCard({ activity }: { activity: ActivityView }) {
  const [updateState, updateAction, isUpdating] = useActionState<ActivityActionState, FormData>(updateActivityAction, {});
  const [deleteState, deleteAction, isDeleting] = useActionState<ActivityActionState, FormData>(deleteActivityAction, {});
  const BucketIcon = bucketIcons[activity.bucket];
  const completedSubtasks = activity.subtasks.filter((subtask) => subtask.completed).length;

  return (
    <article className="activity-card" data-testid={`activity-${activity.id}`}>
      <div className="activity-card__header">
        <div className="min-w-0">
          <p className="bucket-label"><BucketIcon size={14} weight="bold" aria-hidden="true" /> {bucketLabels[activity.bucket]}</p>
          <h2 className="activity-card__title">{activity.title}</h2>
          {activity.description ? <p className="activity-card__description">{activity.description}</p> : null}
        </div>
        <form action={deleteAction} onSubmit={(event: FormEvent<HTMLFormElement>) => { if (!window.confirm(`Excluir a atividade ${activity.title}? As subtasks também serão excluídas.`)) event.preventDefault(); }}>
          <input type="hidden" name="activityId" value={activity.id} />
          <button type="submit" disabled={isDeleting} aria-label={`Excluir atividade ${activity.title}`} className="button-danger min-h-9 px-2.5 text-xs">
            <Trash size={15} weight="regular" aria-hidden="true" />
            <span className="hidden sm:inline">{isDeleting ? "Excluindo..." : "Excluir"}</span>
          </button>
        </form>
      </div>

      <form action={updateAction} className="activity-card__move">
        <input type="hidden" name="activityId" value={activity.id} />
        <input type="hidden" name="title" value={activity.title} />
        <input type="hidden" name="description" value={activity.description ?? ""} />
        <label className="field-label" htmlFor={`activity-area-${activity.id}`}>
          Mover
          <select id={`activity-area-${activity.id}`} name="bucket" defaultValue={activity.bucket} className="field-control">
            <option value="TOMORROW">Amanhã</option>
            <option value="BACKLOG">Backlog</option>
            <option value="PARKED">Estacionado</option>
          </select>
        </label>
        <button type="submit" disabled={isUpdating} className="button-secondary">{isUpdating ? "Salvando..." : "Salvar área"}</button>
        <ActionMessage state={updateState} />
      </form>

      <section className="subtask-section" aria-label={`Subtasks de ${activity.title}`}>
        <div className="subtask-heading">
          <h3 className="subtask-heading__title"><CheckCircle size={16} weight="regular" aria-hidden="true" /> Subtasks</h3>
          <span className="subtask-heading__count">{completedSubtasks}/{activity.subtasks.length}</span>
        </div>
        {activity.subtasks.length ? <ul className="mt-3 list-none p-0">{activity.subtasks.map((subtask) => <SubtaskRow key={subtask.id} subtask={subtask} />)}</ul> : <p className="mt-3 text-sm text-[var(--ink-muted)]">Nenhuma subtask ainda.</p>}
        <CreateSubtaskForm activityId={activity.id} activityTitle={activity.title} />
        <ActionMessage state={deleteState} />
      </section>
    </article>
  );
}

export function ActivityBoard({ activities }: { activities: ActivityView[] }) {
  return (
    <div className="activity-layout">
      <CreateActivityForm />
      <section className="activity-list" aria-live="polite">
        {activities.length === 0 ? <p className="empty-panel">Nenhuma atividade nesta visão.</p> : activities.map((activity) => <ActivityCard key={activity.id} activity={activity} />)}
      </section>
    </div>
  );
}
