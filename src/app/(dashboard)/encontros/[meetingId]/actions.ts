"use server";

import { cookies } from "next/headers";
import { getSession } from "@/features/auth/session-service";
import { cycleAttendance } from "@/features/encontros/attendance-service";
import { addPersonToAttendance, addQuickVisitor, searchAttendancePeople, type AttendanceSearchItem } from "@/features/encontros/attendance-query";
import { getMeetingActor } from "@/features/encontros/meeting-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { AttendanceStatus } from "@prisma/client";

export type AttendanceActionState = { status?: AttendanceStatus; error?: string; conflict?: boolean; attendanceId?: string; personName?: string };

const attendanceErrors = new Set([
  "Sessão inválida.",
  "Presença não encontrada.",
  "Encontro não encontrado.",
  "Encontro cancelado não aceita lançamentos de presença.",
  "Ministério arquivado não aceita novos lançamentos de presença.",
]);

function attendanceActionError(error: unknown) {
  if (error instanceof Error && attendanceErrors.has(error.message)) return error.message;
  return "Não foi possível salvar a presença. Tente novamente.";
}

async function requireActor() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) throw new Error("Sessão inválida.");
  return actor;
}

export async function cycleAttendanceAction(attendanceId: string, expectedStatus: AttendanceStatus, reason?: string): Promise<AttendanceActionState> {
  try {
    const result = await cycleAttendance(await requireActor(), attendanceId, expectedStatus, reason);
    return { status: result.status, conflict: !result.changed };
  } catch (error) {
    return { error: attendanceActionError(error) };
  }
}

export async function searchAttendanceAction(meetingId: string, search: string): Promise<{ people?: AttendanceSearchItem[]; error?: string }> {
  try {
    return { people: await searchAttendancePeople(await requireActor(), meetingId, search) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível buscar Pessoas." };
  }
}

export async function addAttendancePersonAction(meetingId: string, personId: string): Promise<AttendanceActionState & { attendanceId?: string; personName?: string }> {
  try {
    const attendance = await addPersonToAttendance(await requireActor(), meetingId, personId);
    return { status: attendance.status, attendanceId: attendance.id, personName: attendance.person.fullName };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível adicionar a Pessoa." };
  }
}

export async function addQuickVisitorAction(meetingId: string, fullName: string): Promise<AttendanceActionState> {
  try {
    const attendance = await addQuickVisitor(await requireActor(), meetingId, fullName);
    return { status: attendance.status, attendanceId: attendance.id, personName: attendance.person.fullName };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível adicionar o visitante." };
  }
}
