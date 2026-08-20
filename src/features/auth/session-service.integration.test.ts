import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  createSession,
  getSession,
  logout,
} from "./session-service";
import {
  clearSessionCookie,
  createSessionCookie,
  expiredSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "../../lib/session";

describe("account sessions", () => {
  let accountId: string;
  let inactiveAccountId: string;
  const sessionIds: string[] = [];

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: "Pessoa de sessão T12" },
    });
    const inactivePerson = await prisma.person.create({
      data: { fullName: "Pessoa inativa de sessão T12" },
    });
    const account = await prisma.account.create({
      data: {
        personId: person.id,
        username: "sessao-t12",
        email: "sessao-t12@example.test",
        passwordHash: "test-hash",
      },
    });
    const inactiveAccount = await prisma.account.create({
      data: {
        personId: inactivePerson.id,
        username: "sessao-inativa-t12",
        email: "sessao-inativa-t12@example.test",
        passwordHash: "test-hash",
        status: "INACTIVE",
      },
    });
    accountId = account.id;
    inactiveAccountId = inactiveAccount.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.account.deleteMany({
      where: { id: { in: [accountId, inactiveAccountId] } },
    });
    await prisma.person.deleteMany({
      where: { fullName: { in: ["Pessoa de sessão T12", "Pessoa inativa de sessão T12"] } },
    });
    await prisma.$disconnect();
  });

  it("creates a secure cookie payload and looks up an active account", async () => {
    const session = await createSession(accountId);
    sessionIds.push(session.id);
    const account = await getSession(session.token);
    const cookie = createSessionCookie(session.token, session.expiresAt);

    expect(SESSION_COOKIE_NAME).toBe("emaus_session");
    expect(session.token).not.toHaveLength(0);
    expect(cookie.name).toBe(SESSION_COOKIE_NAME);
    expect(cookie.value).toBe(session.token);
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.path).toBe("/");
    expect(account?.id).toBe(accountId);
    expect(account?.status).toBe("ACTIVE");
  });

  it("invalidates the session on logout", async () => {
    const session = await createSession(accountId);
    sessionIds.push(session.id);

    await logout(session.token);

    expect(await getSession(session.token)).toBeNull();
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).not.toBeNull();
  });

  it("does not create a session for an inactive account", async () => {
    await expect(createSession(inactiveAccountId)).rejects.toThrow(
      "Conta inativa ou inexistente",
    );
    expect(await prisma.session.count({ where: { accountId: inactiveAccountId } })).toBe(0);
  });

  it("provides an expired cookie payload for logout", () => {
    expect(clearSessionCookie()).toMatchObject({
      name: SESSION_COOKIE_NAME,
      value: "",
      options: {
        httpOnly: true,
        maxAge: 0,
        expires: new Date(0),
      },
    });
    expect(expiredSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      maxAge: 0,
      expires: new Date(0),
    });
  });
});
