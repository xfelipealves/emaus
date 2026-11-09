import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { auth } from "@/lib/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  personId: string | null;
  mustChangePassword: boolean;
  /** null = enxerga todos os ministérios */
  ministryIds: string[] | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const row = await db.query.user.findFirst({
    where: eq(schema.user.id, session.user.id),
    with: { ministryAccess: true },
  });
  if (!row || !row.active) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.displayUsername ?? row.username,
    role: row.role,
    personId: row.personId,
    mustChangePassword: row.mustChangePassword,
    ministryIds:
      row.role === "leader" ? row.ministryAccess.map((a) => a.ministryId) : null,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Senha definida pelo administrador: troca obrigatória antes de usar o app.
  if (user.mustChangePassword) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (!path.startsWith("/conta")) redirect("/conta?primeiro-acesso=1");
  }
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export const can = {
  manageSettings: (u: CurrentUser) => u.role === "admin",
  manageMinistries: (u: CurrentUser) => u.role === "admin",
  manageEvents: (u: CurrentUser) => u.role !== "leader",
  importPeople: (u: CurrentUser) => u.role !== "leader",
  deletePeople: (u: CurrentUser) => u.role === "admin",
  viewAudit: (u: CurrentUser) => u.role === "admin",
};

/**
 * Pessoas visíveis para o usuário. null = sem restrição.
 * Líder vê quem tem vínculo ativo nos ministérios liberados para ele.
 */
export const visiblePersonIds = cache(
  async (user: CurrentUser): Promise<Set<string> | null> => {
    if (!user.ministryIds) return null;
    if (user.ministryIds.length === 0) return new Set();
    const rows = await db
      .select({ personId: schema.membership.personId })
      .from(schema.membership)
      .where(
        and(
          inArray(schema.membership.ministryId, user.ministryIds),
          isNull(schema.membership.endDate),
        ),
      );
    return new Set(rows.map((r) => r.personId));
  },
);

export async function assertCanSeePerson(user: CurrentUser, personId: string) {
  const ids = await visiblePersonIds(user);
  if (ids && !ids.has(personId)) {
    throw new ActionError("Você não tem acesso a esta pessoa.");
  }
}

export class ActionError extends Error {}
