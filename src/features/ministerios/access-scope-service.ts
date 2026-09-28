import type { AccountRole, AccountMinistryAccess } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canManageAccounts, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type AccessScopeActor = Pick<AuthorizationAccount, "role"> & { id: string };

export async function listLeaderScopeConfiguration(actor: AccessScopeActor) {
  assertCanManageScopes(actor);

  return prisma.account.findMany({
    where: { role: "LEADER" },
    select: {
      id: true,
      username: true,
      status: true,
      person: { select: { fullName: true } },
      ministryAccess: {
        where: { revokedAt: null },
        select: {
          ministryId: true,
          grantedAt: true,
          ministry: { select: { name: true, status: true } },
        },
        orderBy: { grantedAt: "asc" },
      },
    },
    orderBy: { username: "asc" },
  });
}

function assertCanManageScopes(actor: AccessScopeActor) {
  if (!canManageAccounts({ role: actor.role, ministryAccess: [] })) {
    throw new Error("Apenas administradores podem gerenciar escopos ministeriais.");
  }
}

function accessSnapshot(access: Pick<AccountMinistryAccess, "id" | "accountId" | "ministryId" | "grantedAt" | "revokedAt">) {
  return {
    id: access.id,
    accountId: access.accountId,
    ministryId: access.ministryId,
    grantedAt: access.grantedAt.toISOString(),
    revokedAt: access.revokedAt?.toISOString() ?? null,
  };
}

async function assertLeaderAccount(transaction: Parameters<Parameters<typeof withTransaction>[0]>[0], accountId: string) {
  const account = await transaction.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error("Conta não encontrada.");
  }
  if (account.role !== ("LEADER" satisfies AccountRole)) {
    throw new Error("Escopos ministeriais só podem ser concedidos a líderes.");
  }
}

async function assertActiveMinistry(transaction: Parameters<Parameters<typeof withTransaction>[0]>[0], ministryId: string) {
  const ministry = await transaction.ministry.findUnique({ where: { id: ministryId } });
  if (!ministry) {
    throw new Error("Ministério não encontrado.");
  }
  if (ministry.status === "ARCHIVED") {
    throw new Error("Ministério arquivado não aceita novos escopos.");
  }
}

export async function grantMinistryAccess(
  actor: AccessScopeActor,
  input: { accountId: string; ministryId: string },
) {
  assertCanManageScopes(actor);

  return withTransaction(async (transaction) => {
    await assertLeaderAccount(transaction, input.accountId);
    await assertActiveMinistry(transaction, input.ministryId);

    const existing = await transaction.accountMinistryAccess.findUnique({
      where: { accountId_ministryId: input },
    });
    if (existing && existing.revokedAt === null) {
      return existing;
    }

    const access = existing
      ? await transaction.accountMinistryAccess.update({
          where: { id: existing.id },
          data: { grantedAt: new Date(), revokedAt: null },
        })
      : await transaction.accountMinistryAccess.create({ data: input });

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "AccountMinistryAccess",
      targetId: access.id,
      action: "GRANT",
      before: existing ? accessSnapshot(existing) : undefined,
      after: accessSnapshot(access),
    });

    return access;
  });
}

export async function revokeMinistryAccess(
  actor: AccessScopeActor,
  input: { accountId: string; ministryId: string },
) {
  assertCanManageScopes(actor);

  return withTransaction(async (transaction) => {
    const existing = await transaction.accountMinistryAccess.findUnique({
      where: { accountId_ministryId: input },
    });
    if (!existing) {
      throw new Error("Escopo ministerial não encontrado.");
    }
    if (existing.revokedAt !== null) {
      throw new Error("Escopo ministerial já foi revogado.");
    }

    const access = await transaction.accountMinistryAccess.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "AccountMinistryAccess",
      targetId: access.id,
      action: "REVOKE",
      before: accessSnapshot(existing),
      after: accessSnapshot(access),
    });

    return access;
  });
}
