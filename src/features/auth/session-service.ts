import type { Account, Person } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_DURATION_MS,
} from "../../lib/session";

type SessionAccount = Account & { person: Person };

export async function createSession(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });

  if (!account || account.status !== "ACTIVE") {
    throw new Error("Conta inativa ou inexistente");
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await prisma.session.create({
    data: { accountId, tokenHash: hashSessionToken(token), expiresAt },
  });

  await prisma.account.update({
    where: { id: accountId },
    data: { lastLoginAt: new Date() },
  });

  return { id: session.id, token, expiresAt };
}

export async function getSession(token: string): Promise<SessionAccount | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { account: { include: { person: true } } },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date() ||
    session.account.status !== "ACTIVE"
  ) {
    return null;
  }

  return session.account;
}

export async function logout(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
