import "server-only";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ROLES } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { recordAudit } from "./history";
import { ActionError, type CurrentUser } from "./session";

const usernameRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, "Use 3 a 30 letras minúsculas, números, ponto ou hífen");

export const userInput = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(80),
  username: usernameRule,
  email: z.email("E-mail inválido"),
  role: z.enum(ROLES),
  ministryIds: z.array(z.string()).default([]),
  personId: z.string().optional(),
});

export const passwordRule = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(128);

export async function listUsers() {
  const seen = await db
    .select({ userId: schema.session.userId, last: sql<number>`max(${schema.session.updatedAt})` })
    .from(schema.session)
    .groupBy(schema.session.userId);
  const lastSeen = new Map(seen.map((s) => [s.userId, new Date(s.last)]));
  const users = await db.query.user.findMany({
    orderBy: [desc(schema.user.active), asc(schema.user.name)],
    with: {
      ministryAccess: { with: { ministry: { columns: { id: true, name: true, color: true } } } },
      person: { columns: { id: true, fullName: true } },
    },
  });
  return users.map((u) => ({ ...u, lastSeen: lastSeen.get(u.id) ?? null }));
}

async function ensureUnique(username: string, email: string, exceptId?: string) {
  const clash = await db.query.user.findFirst({
    where: and(
      exceptId ? ne(schema.user.id, exceptId) : undefined,
      eq(schema.user.username, username),
    ),
  });
  if (clash) throw new ActionError("Esse nome de usuário já está em uso.");
  const mail = await db.query.user.findFirst({
    where: and(exceptId ? ne(schema.user.id, exceptId) : undefined, eq(schema.user.email, email.toLowerCase())),
  });
  if (mail) throw new ActionError("Esse e-mail já está em uso.");
}

/** Cria conta com senha diretamente pelo adaptador interno (cadastro público desligado). */
export async function createUserAccount(
  actor: CurrentUser | null,
  raw: unknown,
  password: string,
) {
  const input = userInput.parse(raw);
  passwordRule.parse(password);
  await ensureUnique(input.username, input.email);
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser({
    name: input.name,
    email: input.email.toLowerCase(),
    username: input.username,
    displayUsername: input.username,
    role: input.role,
    active: true,
    mustChangePassword: true,
    personId: input.personId ?? null,
  }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(password),
  });
  await setMinistryAccess(created.id, input.role === "leader" ? input.ministryIds : []);
  await recordAudit(db, {
    actorId: actor?.id ?? null,
    entity: "user",
    entityId: created.id,
    action: "create",
    summary: `Conta de ${input.name} criada como ${ROLE_LABEL[input.role]}`,
  });
  return created;
}

async function setMinistryAccess(userId: string, ministryIds: string[]) {
  await db.delete(schema.userMinistryAccess).where(eq(schema.userMinistryAccess.userId, userId));
  if (ministryIds.length) {
    await db
      .insert(schema.userMinistryAccess)
      .values([...new Set(ministryIds)].map((ministryId) => ({ userId, ministryId })));
  }
}

async function adminCount() {
  const admins = await db.query.user.findMany({
    where: and(eq(schema.user.role, "admin"), eq(schema.user.active, true)),
    columns: { id: true },
  });
  return admins.length;
}

export async function updateUserAccount(actor: CurrentUser, id: string, raw: unknown) {
  const input = userInput.parse(raw);
  const before = await db.query.user.findFirst({ where: eq(schema.user.id, id) });
  if (!before) throw new ActionError("Usuário não encontrado.");
  if (before.role === "admin" && input.role !== "admin" && (await adminCount()) <= 1) {
    throw new ActionError("A igreja precisa de ao menos um administrador ativo.");
  }
  await ensureUnique(input.username, input.email, id);
  await db
    .update(schema.user)
    .set({
      name: input.name,
      username: input.username,
      displayUsername: input.username,
      email: input.email.toLowerCase(),
      role: input.role,
      personId: input.personId ?? null,
    })
    .where(eq(schema.user.id, id));
  await setMinistryAccess(id, input.role === "leader" ? input.ministryIds : []);
  if (before.role !== input.role) {
    await recordAudit(db, {
      actorId: actor.id,
      entity: "user",
      entityId: id,
      action: "role.change",
      summary: `${input.name}: ${ROLE_LABEL[before.role]} → ${ROLE_LABEL[input.role]}`,
      before: { role: before.role },
      after: { role: input.role },
    });
  }
}

export async function setUserActive(actor: CurrentUser, id: string, active: boolean) {
  if (actor.id === id && !active) throw new ActionError("Você não pode desativar a própria conta.");
  const before = await db.query.user.findFirst({ where: eq(schema.user.id, id) });
  if (!before) throw new ActionError("Usuário não encontrado.");
  if (!active && before.role === "admin" && (await adminCount()) <= 1) {
    throw new ActionError("A igreja precisa de ao menos um administrador ativo.");
  }
  await db.update(schema.user).set({ active }).where(eq(schema.user.id, id));
  if (!active) await db.delete(schema.session).where(eq(schema.session.userId, id));
  await recordAudit(db, {
    actorId: actor.id,
    entity: "user",
    entityId: id,
    action: active ? "activate" : "deactivate",
    summary: `Conta de ${before.name} ${active ? "reativada" : "desativada"}`,
  });
}

export async function resetUserPassword(actor: CurrentUser, id: string, password: string) {
  passwordRule.parse(password);
  const target = await db.query.user.findFirst({ where: eq(schema.user.id, id) });
  if (!target) throw new ActionError("Usuário não encontrado.");
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(id, await ctx.password.hash(password));
  // Senha definida por outra pessoa é provisória: sessões caem e a troca vira obrigatória.
  if (actor.id !== id) {
    await db.delete(schema.session).where(eq(schema.session.userId, id));
    await db.update(schema.user).set({ mustChangePassword: true }).where(eq(schema.user.id, id));
  }
  await recordAudit(db, {
    actorId: actor.id,
    entity: "user",
    entityId: id,
    action: "password.reset",
    summary: `Senha de ${target.name} redefinida`,
  });
}

export async function revokeUserSessions(actor: CurrentUser, id: string) {
  const target = await db.query.user.findFirst({ where: eq(schema.user.id, id) });
  if (!target) throw new ActionError("Usuário não encontrado.");
  if (actor.id === id) throw new ActionError("Use “Sair” para encerrar a sua própria sessão.");
  await db.delete(schema.session).where(eq(schema.session.userId, id));
  await recordAudit(db, {
    actorId: actor.id,
    entity: "user",
    entityId: id,
    action: "sessions.revoke",
    summary: `Sessões de ${target.name} encerradas`,
  });
}

export async function listAudit(limit = 200) {
  return db.query.auditLog.findMany({
    orderBy: desc(schema.auditLog.createdAt),
    with: { actor: { columns: { name: true } } },
    limit,
  });
}
