import type { Metadata } from "next";
import { LogoMark } from "@/components/app/logo";
import { formatDate, formatTime, upperFirst } from "@/lib/dates";
import { getEventByToken } from "@/server/events";
import { getSettings } from "@/server/settings";
import { SelfCheckin } from "./self-checkin";

export const metadata: Metadata = { title: "Check-in", robots: { index: false } };

export default async function PublicCheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [ev, settings] = await Promise.all([getEventByToken(token), getSettings()]);
  const tz = settings.timezone;
  const open = !!ev && ev.checkinOpen && !ev.cancelled;

  return (
    <main className="paper flex min-h-svh flex-col items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div className="leading-tight">
            <div className="font-medium">{settings.name}</div>
            {ev && <div className="text-xs text-muted-foreground">{upperFirst(formatDate(ev.startsAt, tz, { weekday: "long", day: "numeric", month: "long" }))} · {formatTime(ev.startsAt, tz)}</div>}
          </div>
        </div>
        {ev && <h1 className="mt-10 font-display text-5xl leading-none text-balance">{ev.title}</h1>}
        {open ? (
          <SelfCheckin token={token} />
        ) : (
          <div className="mt-10 rounded-2xl border bg-card p-6 text-center shadow-xs">
            <p className="font-display text-2xl">Check-in fechado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {ev ? "Procure a equipe de recepção para registrar sua presença." : "Este link não é válido."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
