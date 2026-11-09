"use server";

import { redirect } from "next/navigation";
import { formToObject, runAction } from "@/server/action";
import {
  addQuickVisitor,
  createEvent,
  deleteEvent,
  markAllAbsent,
  setAttendance,
  setCheckinOpen,
  setEventCancelled,
  updateEvent,
} from "@/server/events";
import { ActionError, can, requireUser } from "@/server/session";

async function requireEventManager() {
  const user = await requireUser();
  if (!can.manageEvents(user)) throw new ActionError("Apenas secretaria e administradores gerenciam encontros.");
  return user;
}

export async function saveEventAction(id: string | null, form: FormData) {
  return runAction(async () => {
    const user = await requireEventManager();
    const data = formToObject(form);
    if (id) {
      await updateEvent(user, id, data);
      return { id };
    }
    return { id: (await createEvent(user, data)).id };
  }, id ? "Encontro atualizado" : "Encontro criado");
}

export async function setAttendanceAction(
  eventId: string,
  personId: string,
  status: "present" | "absent" | null,
  method: "manual" | "kiosk" = "manual",
) {
  return runAction(async () => setAttendance(await requireUser(), eventId, personId, status, method));
}

export async function markAllAbsentAction(eventId: string) {
  return runAction(async () => {
    const n = await markAllAbsent(await requireUser(), eventId);
    return n;
  }, "Pendentes marcados como ausentes");
}

export async function quickVisitorAction(eventId: string, fullName: string, phone: string, method: "manual" | "kiosk" = "manual") {
  return runAction(async () => {
    const p = await addQuickVisitor(await requireUser(), eventId, { fullName, phone }, method);
    return { id: p.id, fullName: p.fullName };
  }, "Visitante registrado e marcado presente");
}

export async function setCheckinOpenAction(eventId: string, open: boolean) {
  return runAction(async () => {
    await requireEventManager();
    await setCheckinOpen(eventId, open);
  }, open ? "Check-in por QR aberto" : "Check-in por QR fechado");
}

export async function cancelEventAction(eventId: string, cancelled: boolean) {
  return runAction(async () => setEventCancelled(await requireEventManager(), eventId, cancelled), cancelled ? "Encontro cancelado" : "Encontro reativado");
}

export async function deleteEventAction(eventId: string, scope: "one" | "future") {
  const result = await runAction(async () => deleteEvent(await requireEventManager(), eventId, scope));
  if (result.ok) redirect("/encontros");
  return result;
}
