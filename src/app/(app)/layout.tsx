import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app/app-sidebar";
import { CommandMenu } from "@/components/app/command-menu";
import { MobileNav } from "@/components/app/mobile-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { db, schema } from "@/db";
import { listPeople } from "@/server/people";
import { inChurch, requireUser } from "@/server/session";
import { getSettings } from "@/server/settings";
import { displayName } from "@/lib/text";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // O layout também envolve /conta; as demais páginas barram a senha provisória no próprio requireUser.
  const user = await requireUser({ pendingPassword: true });
  if (user.mustChangePassword && !((await headers()).get("x-pathname") ?? "").startsWith("/conta")) {
    redirect("/conta?primeiro-acesso=1");
  }
  const [settings, people, [followUps], cookieStore] = await Promise.all([
    getSettings(user.churchId),
    // Senha provisória: nada de dados pastorais antes da troca.
    user.mustChangePassword ? [] : listPeople(user),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.followUp)
      .where(and(inChurch(user, schema.followUp), isNull(schema.followUp.doneAt), eq(schema.followUp.assigneeId, user.id))),
    cookies(),
  ]);
  const badges = { followUps: followUps?.n ?? 0 };

  return (
    <SidebarProvider defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}>
      <AppSidebar
        user={{ id: user.id, name: user.name, role: user.role, username: user.username, platformAdmin: user.platformAdmin }}
        churchName={settings.name}
        badges={badges}
      />
      <SidebarInset className="min-w-0">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 md:pt-8 md:pb-12 lg:px-10">
          {user.demo && (
            <div role="status" className="mb-6 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              Demonstração pública · Dados fictícios e compartilhados. Não cadastre informações pessoais reais. Contas e configuração de IA estão protegidas.
            </div>
          )}
          {children}
        </div>
      </SidebarInset>
      <MobileNav badges={badges} />
      <CommandMenu
        isAdmin={user.role === "admin"}
        people={people.map((p) => ({ id: p.id, name: displayName(p), status: p.status }))}
      />
    </SidebarProvider>
  );
}
