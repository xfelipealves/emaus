import { CalendarDays, Clock, MapPin, MonitorSmartphone, Repeat, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PageHeader } from "@/components/app/page-header";
import { ToneBadge } from "@/components/app/tone";
import { EventSheet } from "@/components/events/event-form";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime, hoursUntil, upperFirst, isoDateInTz, timeInTz } from "@/lib/dates";
import { RECURRENCE_LABEL } from "@/lib/labels";
import { attendanceRoster, getEvent, listCategories } from "@/server/events";
import { listMinistries } from "@/server/ministries";
import { can, requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { publicBaseUrl } from "@/server/url";
import { EventMenu, QrDialog } from "./event-tools";
import { Roster } from "./roster";

export const metadata: Metadata = { title: "Encontro" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ev = await getEvent(user, id);
  if (!ev) notFound();
  const [settings, roster, categories, ministries, base] = await Promise.all([
    getSettings(),
    attendanceRoster(user, id),
    listCategories(),
    listMinistries(user),
    publicBaseUrl(),
  ]);
  const tz = settings.timezone;
  const url = `${base}/c/${ev.checkinToken}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#2a211c", light: "#ffffff" } });
  const manage = can.manageEvents(user);
  const future = hoursUntil(ev.startsAt) > 36;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/encontros" className="hover:text-foreground">Encontros</Link>}
        title={<span className={ev.cancelled ? "line-through decoration-2 opacity-60" : undefined}>{ev.title}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{upperFirst(formatDate(ev.startsAt, tz, { weekday: "long", day: "numeric", month: "long" }))}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" />{formatTime(ev.startsAt, tz)}{ev.endsAt && `–${formatTime(ev.endsAt, tz)}`}</span>
            {ev.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{ev.location}</span>}
            <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" />{ev.audience.length ? ev.audience.map((a) => a.ministry.name).join(", ") : "Igreja toda"}</span>
            {ev.series && <span className="inline-flex items-center gap-1.5"><Repeat className="size-3.5" />{RECURRENCE_LABEL[ev.series.recurrence]}</span>}
            {ev.category && <ToneBadge tone={ev.category.color}>{ev.category.name}</ToneBadge>}
            {ev.cancelled && <ToneBadge tone="slate">cancelado</ToneBadge>}
          </span>
        }
        actions={
          <>
            {!ev.cancelled && (
              <Button render={<Link href={`/checkin/${ev.id}`} />} nativeButton={false}>
                <MonitorSmartphone data-icon="inline-start" /> Modo recepção
              </Button>
            )}
            {!ev.cancelled && <QrDialog eventId={ev.id} url={url} svg={svg} open={ev.checkinOpen} canManage={manage} />}
            {manage && (
              <>
                <EventSheet
                  categories={categories}
                  ministries={ministries.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
                  today={isoDateInTz(ev.startsAt, tz)}
                  initial={{
                    id: ev.id,
                    title: ev.title,
                    description: ev.description,
                    categoryId: ev.categoryId,
                    date: isoDateInTz(ev.startsAt, tz),
                    time: timeInTz(ev.startsAt, tz),
                    durationMinutes: ev.endsAt ? Math.round((ev.endsAt.getTime() - ev.startsAt.getTime()) / 60000) : 120,
                    location: ev.location,
                    ministryIds: ev.audience.map((a) => a.ministryId),
                  }}
                />
                <EventMenu eventId={ev.id} cancelled={ev.cancelled} inSeries={!!ev.seriesId} />
              </>
            )}
          </>
        }
      />
      {ev.description && <p className="-mt-2 mb-6 max-w-2xl text-sm text-muted-foreground">{ev.description}</p>}
      {future && !ev.cancelled && (
        <p className="mb-4 rounded-xl bg-gold/10 px-4 py-3 text-sm">Este encontro ainda não aconteceu. Você já pode preparar a lista, mas a presença costuma ser lançada no dia.</p>
      )}
      <Roster
        key={ev.id}
        eventId={ev.id}
        disabled={ev.cancelled}
        rows={roster.map((r) => ({
          id: r.id,
          fullName: r.fullName,
          preferredName: r.preferredName,
          status: r.status,
          attendance: r.attendance,
          method: r.method,
          inAudience: r.inAudience,
        }))}
      />
    </>
  );
}
