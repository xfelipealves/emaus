import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/features/auth/session-service";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const account = token ? await getSession(token) : null;

  if (!account) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
