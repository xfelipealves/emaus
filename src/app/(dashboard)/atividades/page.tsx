import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { getActivityActor, listActivities, type ActivityBucket } from "@/features/atividades/activity-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { ActivityBoard, type ActivityView } from "./activity-board";

const filters = [
  { value: "all", label: "Todas" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "backlog", label: "Backlog" },
  { value: "parked", label: "Estacionado" },
] as const;

type ActivityFilter = (typeof filters)[number]["value"];

function parseFilter(value: string | undefined): ActivityFilter {
  return filters.some((filter) => filter.value === value) ? (value as ActivityFilter) : "all";
}

function filterToBucket(filter: ActivityFilter): ActivityBucket | undefined {
  if (filter === "tomorrow") return "TOMORROW";
  if (filter === "backlog") return "BACKLOG";
  if (filter === "parked") return "PARKED";
  return undefined;
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getActivityActor(account.id) : null;
  if (!actor) redirect("/login");

  const filter = parseFilter((await searchParams).bucket);
  const activities = await listActivities(actor, filterToBucket(filter));
  const view: ActivityView[] = activities.map((activity) => ({
    id: activity.id,
    title: activity.title,
    description: activity.description,
    bucket: activity.bucket,
    subtasks: activity.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      completed: subtask.completed,
    })),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#26766d]">Organização</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Atividades</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Um espaço compartilhado para o próximo passo da equipe.</p>
        </div>
        <form method="get" className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400" htmlFor="activity-filter">
            Visão
            <select id="activity-filter" name="bucket" defaultValue={filter} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-[#26766d]">
              {filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-9 rounded-lg bg-[#e3f1ed] px-3 text-xs font-semibold text-[#155e58] hover:bg-[#dceee9]">Ver</button>
        </form>
      </header>
      <section className="mt-8">
        <ActivityBoard activities={view} />
      </section>
    </div>
  );
}
