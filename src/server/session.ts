import "server-only";
import { type AnyColumn, and, eq, inArray, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import type { Role } from "@/db/schema";
import { auth } from "@/lib/auth";

/** Conta logada, com ou sem igreja (contas só da plataforma não têm). */
export type Account = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  personId: string | null;
  mustChangePassword: boolean;
  /** null = enxerga todos os ministérios */
  ministryIds: string[] | null;
  churchId: string | null;
  platformAdmin: boolean;
  /** Igreja de demonstração pública: contas e configuração de IA travadas. */
  demo: boolean;
};

/** Usuário dentro de uma igreja ativa: toda consulta do app filtra por `churchId`. */
export type CurrentUser = Account & { churchId: string };

export const getAccount = cache(async (): Promise<Account | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const row = await db.query.user.findFirst({
    where: eq(schema.user.id, session.user.id),
    with: { ministryAccess: true, church: { columns: { active: true, demo: true } } },
  });
  if (!row || !row.active) return null;
  // Igreja desativada: ninguém dela entra (a plataforma continua acessível a quem a opera).
  const churchActive = Boolean(row.church?.active);
  if (!churchActive && !row.platformAdmin) return null;
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
    churchId: churchActive ? row.churchId : null,
    platformAdmin: row.platformAdmin,
    demo: Boolean(row.church?.demo),
  };
});

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const account = await getAccount();
  return account?.churchId ? { ...account, churchId: account.churchId } : null;
});

/**
 * Senha definida pelo administrador: troca obrigatória antes de usar o app. Só /conta passa
 * `pendingPassword` — o caminho da requisição não serve de critério, pois uma server action
 * pode ser enviada a qualquer URL.
 */
export async function requireUser(opts?: { pendingPassword?: boolean }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  const user = await getCurrentUser();
  // Conta só da plataforma (ou igreja desativada): o lugar dela é o painel da plataforma.
  if (!user) redirect("/plataforma");
  if (user.mustChangePassword && !opts?.pendingPassword) redirect("/conta?primeiro-acesso=1");
  return user;
}

/** Painel da plataforma: só quem opera o Emaús, nunca a partir de dados de uma igreja. */
export async function requirePlatformAdmin() {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (!account.platformAdmin) redirect("/");
  // A troca de senha mora em /conta, dentro da igreja; conta só da plataforma troca pelo script.
  if (account.mustChangePassword && account.churchId) redirect("/conta?primeiro-acesso=1");
  return account;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** Condição de igreja para consultas: `inChurch(user, schema.person)`. */
export function inChurch(user: { churchId: string }, table: { churchId: AnyColumn }) {
  return eq(table.churchId, user.churchId);
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
          inChurch(user, schema.membership),
          inArray(schema.membership.ministryId, user.ministryIds),
          isNull(schema.membership.endDate),
        ),
      );
    return new Set(rows.map((r) => r.personId));
  },
);

/** Pessoa da igreja do usuário e dentro do escopo dele (líder: só os ministérios liberados). */
export async function assertCanSeePerson(user: CurrentUser, personId: string) {
  const ids = await visiblePersonIds(user);
  if (ids && !ids.has(personId)) {
    throw new ActionError("Você não tem acesso a esta pessoa.");
  }
  if (!ids) {
    // Sem lista de escopo, confere a igreja: um id de outra igreja não pode passar.
    const row = await db.query.person.findFirst({
      where: and(eq(schema.person.id, personId), inChurch(user, schema.person)),
      columns: { id: true },
    });
    if (!row) throw new ActionError("Pessoa não encontrada.");
  }
}

export class ActionError extends Error {}
