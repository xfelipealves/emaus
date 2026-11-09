import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/features/auth/session-service";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export default async function SettingsPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;

  if (!account || account.role !== "ADMINISTRATOR") {
    redirect("/");
  }

  redirect("/configuracoes/usuarios");
}
