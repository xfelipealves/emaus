import type { AccountRole, AccountStatus } from "@prisma/client";
import { hashPassword } from "./password";
import { prisma } from "../../lib/prisma";
import { canManageAccounts, type AuthorizationAccount } from "../../server/authorization";

export type AccountActor = Pick<AuthorizationAccount, "role">;

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

  try {
    return await prisma.account.create({
      data: {
        personId: input.personId,
        username: input.username.trim(),
        email: input.email.trim().toLowerCase(),
        passwordHash: await hashPassword(input.password),
        role: input.role,
      },
      include: { person: true },
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

  return prisma.account.update({
    where: { id: accountId },
    data: { status: "INACTIVE" satisfies AccountStatus },
    include: { person: true },
  });
}
