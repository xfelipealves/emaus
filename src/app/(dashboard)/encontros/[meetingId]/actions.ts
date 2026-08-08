"use server";

import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { cycleAttendance } from "@/features/encontros/attendance-service";
import { getMeetingActor } from "@/features/encontros/meeting-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export type AttendanceActionState = { status?: "NOT_CONFIRMED" | "PRESENT" | "ABSENT"; error?: string };

export async function cycleAttendanceAction(attendanceId: string, reason?: string): Promise<AttendanceActionState> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    const account = token ? await getSession(token) : null;
    const actor = account ? await getMeetingActor(account.id) : null;
    if (!actor) throw new Error("Sessão inválida.");
    const attendance = await cycleAttendance(actor, attendanceId, reason);
    return { status: attendance.status };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar a presença." };
  }
}
