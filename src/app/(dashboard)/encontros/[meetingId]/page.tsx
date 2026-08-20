import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { getAttendanceBoard, openAttendance } from "@/features/encontros/attendance-service";
import { getMeetingActor } from "@/features/encontros/meeting-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { AttendanceBoard } from "./attendance-board";

export default async function MeetingAttendancePage({ params }: { params: Promise<{ meetingId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) redirect("/login");
  const { meetingId } = await params;
  try {
    await getAttendanceBoard(actor, meetingId);
    await openAttendance(meetingId);
    const meeting = await getAttendanceBoard(actor, meetingId);
    return <div className="mx-auto max-w-3xl"><Link href="/encontros" className="text-sm font-semibold text-[#26766d]">← Encontros</Link><header className="mt-6"><p className="text-sm font-medium text-[#26766d]">Frequência</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{meeting.title}</h1><p className="mt-2 text-sm text-slate-500">Toque em uma Pessoa para alternar o estado da presença.</p></header><section className="mt-8"><AttendanceBoard meetingId={meetingId} rows={meeting.attendances} /></section></div>;
  } catch {
    redirect("/encontros");
  }
}
