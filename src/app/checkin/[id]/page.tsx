import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { attendanceRoster, getEvent } from "@/server/events";
import { requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { formatDate, formatTime } from "@/lib/dates";
import { Kiosk } from "./kiosk";

export const metadata: Metadata = { title: "Recepção" };

export default async function KioskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const ev = await getEvent(user, id);
  if (!ev || ev.cancelled) notFound();
  const [settings, roster] = await Promise.all([getSettings(), attendanceRoster(user, id)]);
  const tz = settings.timezone;
  return (
    <Kiosk
      eventId={ev.id}
      churchName={settings.name}
      title={ev.title}
      when={`${formatDate(ev.startsAt, tz, { weekday: "long", day: "numeric", month: "long" })} · ${formatTime(ev.startsAt, tz)}`}
      people={roster.map((r) => ({ id: r.id, fullName: r.fullName, preferredName: r.preferredName, status: r.status, present: r.attendance === "present" }))}
    />
  );
}
