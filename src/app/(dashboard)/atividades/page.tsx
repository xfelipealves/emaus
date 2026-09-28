import { ListChecks } from "@phosphor-icons/react/ssr";
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
    <div className="page-frame">
      <header className="page-heading">
        <div>
          <p className="page-kicker"><ListChecks size={14} weight="bold" aria-hidden="true" /> Organização</p>
          <h1 className="page-title">Atividades</h1>
          <p className="page-lead">Um espaço compartilhado para o próximo passo da equipe.</p>
        </div>
        <form method="get" className="view-switcher">
          <label className="field-label" htmlFor="activity-filter">
            Visão
            <select id="activity-filter" name="bucket" defaultValue={filter} className="field-control">
              {filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="submit" className="button-secondary">Ver</button>
        </form>
      </header>
      <section aria-label="Quadro de atividades">
        <ActivityBoard activities={view} />
      </section>
    </div>
  );
}
