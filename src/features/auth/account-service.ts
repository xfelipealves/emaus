import type { AccountRole, AccountStatus } from "@prisma/client";
import { hashPassword } from "./password";
import { prisma } from "../../lib/prisma";
import { canManageAccounts, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type AccountActor = Pick<AuthorizationAccount, "role"> & { id: string };

export type CreateAccountInput = {
  personId: string;
  username: string;
  email: string;
  password: string;
  role: AccountRole;
};

function assertCanManageAccounts(actor: AccountActor) {
  if (!canManageAccounts({ ...actor, ministryAccess: [] })) {
    throw new Error("Apenas administradores podem gerenciar contas.");
  }
}

export async function listAccounts(actor: AccountActor) {
  assertCanManageAccounts(actor);

  return prisma.account.findMany({
    include: { person: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listPeopleWithoutAccounts(actor: AccountActor) {
  assertCanManageAccounts(actor);

  return prisma.person.findMany({
    where: { account: null },
    orderBy: { fullName: "asc" },
  });
}

export async function createAccount(actor: AccountActor, input: CreateAccountInput) {
  assertCanManageAccounts(actor);

  const person = await prisma.person.findUnique({
    where: { id: input.personId },
    include: { account: true },
  });
  if (!person) {
    throw new Error("Pessoa não encontrada.");
  }

  if (!input.username.trim() || !input.email.trim() || !input.password) {
    throw new Error("Preencha todos os campos da conta.");
  }

  if (person.account) {
    throw new Error("Esta Pessoa já possui uma conta.");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await withTransaction(async (transaction) => {
      const account = await transaction.account.create({
        data: {
          personId: input.personId,
          username: input.username.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash,
          role: input.role,
        },
        include: { person: true },
      });

      await recordAuditEvent(transaction, {
        actorId: actor.id,
        targetType: "Account",
        targetId: account.id,
        action: "CREATE",
        after: { role: account.role, status: account.status },
      });

      return account;
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      throw new Error("Nome de usuário, e-mail ou Pessoa já está em uso.");
    }
    throw error;
  }
}

export async function deactivateAccount(actor: AccountActor, accountId: string) {
  assertCanManageAccounts(actor);

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error("Conta não encontrada.");
  }

  return withTransaction(async (transaction) => {
    const deactivated = await transaction.account.update({
      where: { id: accountId },
      data: { status: "INACTIVE" satisfies AccountStatus },
      include: { person: true },
    });

    await transaction.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Account",
      targetId: accountId,
      action: "DEACTIVATE",
      before: { status: account.status },
      after: { status: deactivated.status },
    });

    return deactivated;
  });
}

export async function resetAccountPassword(
  actor: AccountActor,
  accountId: string,
  password: string,
) {
  assertCanManageAccounts(actor);

  if (!password.trim()) {
    throw new Error("Informe a nova senha.");
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error("Conta não encontrada.");
  }

  const passwordHash = await hashPassword(password);

  return withTransaction(async (transaction) => {
    const updatedAccount = await transaction.account.update({
      where: { id: accountId },
      data: { passwordHash },
    });

    await transaction.session.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Account",
      targetId: accountId,
      action: "PASSWORD_RESET",
      after: { passwordReset: true },
    });

    return updatedAccount;
  });
}
