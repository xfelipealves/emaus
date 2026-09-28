import { ArrowUpRight, CalendarBlank, ClipboardText, UserPlus, UsersThree } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { getMeetingActor, listMeetings } from "@/features/encontros/meeting-service";
import { BRAZIL_TIME_ZONE } from "@/lib/dates";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const quickActions = [
  {
    title: "Cadastrar pessoa",
    description: "Adicione um visitante ou membro.",
    href: "/pessoas",
    label: "Pessoas",
    icon: UserPlus,
    featured: true,
  },
  {
    title: "Criar encontro",
    description: "Organize a próxima reunião.",
    href: "/encontros",
    label: "Agenda",
    icon: CalendarBlank,
    featured: false,
  },
  {
    title: "Lançar frequência",
    description: "Registre quem está presente.",
    href: "/encontros",
    label: "Presença",
    icon: ClipboardText,
    featured: false,
  },
] as const;

function formatToday() {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    weekday: "long",
    timeZone: BRAZIL_TIME_ZONE,
  }).format(new Date());

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatMeetingDate(date: Date) {
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: BRAZIL_TIME_ZONE }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: BRAZIL_TIME_ZONE })
      .format(date)
      .replace(/\.$/, "")
      .toUpperCase(),
    time: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: BRAZIL_TIME_ZONE,
    }).format(date),
  };
}

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  const meetings = actor ? await listMeetings(actor) : [];
  const now = new Date();
  const upcomingMeetings = meetings
    .filter((meeting) => meeting.status === "SCHEDULED" && meeting.scheduledAt >= now)
    .slice(0, 2);
  const nextMeeting = upcomingMeetings[0];

  return (
    <div className="page-frame">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="page-kicker"><CalendarBlank size={14} weight="bold" aria-hidden="true" /> {formatToday()}</p>
          <h1 className="home-hero__title">A comunidade em um só lugar.</h1>
          <p className="home-hero__lead">O cuidado começa aqui. Acompanhe a vida da comunidade e encontre o próximo passo da sua equipe.</p>
        </div>
        <aside className="dayline" aria-label="Próximo compromisso">
          <p className="dayline__date">{nextMeeting ? formatMeetingDate(nextMeeting.scheduledAt).day : "—"} <span>{nextMeeting ? formatMeetingDate(nextMeeting.scheduledAt).month : "AGENDA"}</span></p>
          <p className="dayline__label">Próximo compromisso</p>
          {nextMeeting ? (
            <>
              <p className="dayline__event"><Link href={`/encontros/${nextMeeting.id}`}>{nextMeeting.title}</Link></p>
              <p className="dayline__meta">{formatMeetingDate(nextMeeting.scheduledAt).time} · {nextMeeting.audiences.length ? nextMeeting.audiences.map(({ ministry }) => ministry.name).join(", ") : "Toda a igreja"}</p>
            </>
          ) : (
            <>
              <p className="dayline__event">Nenhum encontro agendado</p>
              <p className="dayline__meta">A agenda futura aparecerá aqui.</p>
            </>
          )}
        </aside>
      </section>

      <section aria-label="Atalhos rápidos" className="quick-actions">
        {quickActions.map(({ title, description, href, label, icon: Icon, featured }) => (
          <Link key={title} href={href} className={`quick-action ${featured ? "quick-action--feature" : ""}`}>
            <div className="quick-action__top">
              <span className="quick-action__icon"><Icon size={20} weight="regular" aria-hidden="true" /></span>
              <span className="quick-action__eyebrow">{label}</span>
            </div>
            <div className="quick-action__bottom">
              <div>
                <h2 className="quick-action__title">{title}</h2>
                <p className="quick-action__description">{description}</p>
              </div>
              <ArrowUpRight className="quick-action__arrow" size={19} weight="bold" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </section>

      <section className="home-grid">
        <div className="surface-panel agenda-panel">
          <div className="panel-heading">
            <div>
              <h2 className="panel-heading__title">Próximos encontros</h2>
              <p className="panel-heading__meta">O que já está no caminho da comunidade.</p>
            </div>
            <Link href="/encontros" className="text-link">Ver todos <ArrowUpRight size={15} weight="bold" aria-hidden="true" /></Link>
          </div>
          <div className="schedule-list">
            {upcomingMeetings.length === 0 ? (
              <p className="schedule-empty">Nenhum encontro futuro agendado.</p>
            ) : upcomingMeetings.map((meeting) => {
              const date = formatMeetingDate(meeting.scheduledAt);
              const audience = meeting.audiences.length
                ? meeting.audiences.map(({ ministry }) => ministry.name).join(", ")
                : "Toda a igreja";

              return (
                <Link key={meeting.id} href={`/encontros/${meeting.id}`} className="schedule-item">
                  <span className="date-tile"><span className="date-tile__month">{date.month}</span><span className="date-tile__day">{date.day}</span></span>
                  <span className="schedule-item__copy">
                    <span className="schedule-item__title">{meeting.title}</span>
                    <span className="schedule-item__meta">{date.time} · {audience}</span>
                  </span>
                  <ArrowUpRight className="schedule-item__action" size={18} weight="bold" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="surface-panel community-panel">
          <div className="panel-heading">
            <div>
              <h2 className="panel-heading__title">Organize os próximos passos.</h2>
              <p className="panel-heading__meta">Um quadro compartilhado para a equipe.</p>
            </div>
            <UsersThree size={22} weight="regular" aria-hidden="true" />
          </div>
          <p className="community-panel__copy">Reúna tarefas, acompanhe subtarefas e deixe claro o que precisa de atenção da comunidade.</p>
          <Link href="/atividades" className="button-primary community-panel__action">Abrir atividades <ArrowUpRight size={16} weight="bold" aria-hidden="true" /></Link>
        </aside>
      </section>
    </div>
  );
}
