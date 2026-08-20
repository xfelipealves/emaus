import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { getMeetingActor, listMeetingOptions } from "@/features/encontros/meeting-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { CreateMeetingForm } from "../meeting-forms";

export default async function NewMeetingPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;
  const actor = account ? await getMeetingActor(account.id) : null;
  if (!actor) redirect("/login");
  const { categories, ministries } = await listMeetingOptions(actor);
  return <div className="mx-auto max-w-2xl"><p className="text-sm font-medium text-[#26766d]">Agenda</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Novo encontro</h1><div className="mt-8"><CreateMeetingForm categories={categories} ministries={ministries} /></div></div>;
}
