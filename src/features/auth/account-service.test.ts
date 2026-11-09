import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, deactivateAccount, resetAccountPassword } from "./account-service";
import { verifyPassword } from "./password";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  accountUpdate: vi.fn(),
  accountCreate: vi.fn(),
  personFindUnique: vi.fn(),
  sessionUpdateMany: vi.fn(),
  auditEventCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    account: {
      findUnique: mocks.accountFindUnique,
      update: mocks.accountUpdate,
      create: mocks.accountCreate,
    },
    person: { findUnique: mocks.personFindUnique },
    session: { updateMany: mocks.sessionUpdateMany },
    $transaction: mocks.transaction,
  },
}));

describe("account administration", () => {
  const actor = { id: "admin-qa", role: "ADMINISTRATOR" as const };
  const account = {
    id: "account-qa",
    personId: "person-qa",
    username: "qa-user",
    email: "qa-user@example.test",
    passwordHash: "old-password-hash",
    role: "SECRETARY" as const,
    status: "ACTIVE" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindUnique.mockResolvedValue(account);
    mocks.personFindUnique.mockResolvedValue({ id: account.personId, account: null });
    mocks.accountCreate.mockResolvedValue(account);
    mocks.accountUpdate.mockImplementation(async ({ data }) => ({ ...account, ...data }));
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.auditEventCreate.mockImplementation(async ({ data }) => data);
    mocks.transaction.mockImplementation(async (work) => work({
      account: { update: mocks.accountUpdate, create: mocks.accountCreate },
      session: { updateMany: mocks.sessionUpdateMany },
      auditEvent: { create: mocks.auditEventCreate },
    }));
  });

  it("creates a linked account and records an audit event without the password", async () => {
    const newPassword = "senha-inicial-qa";

    await createAccount(actor, {
      personId: account.personId,
      username: account.username,
      email: account.email,
      password: newPassword,
      role: account.role,
    });

    const audit = mocks.auditEventCreate.mock.calls[0]?.[0].data;
    expect(audit).toMatchObject({
      actorId: actor.id,
      targetType: "Account",
      targetId: account.id,
      action: "CREATE",
      after: { role: "SECRETARY", status: "ACTIVE" },
    });
    expect(JSON.stringify(audit)).not.toContain(newPassword);
    expect(JSON.stringify(audit)).not.toContain("passwordHash");
  });

  it("deactivates an account, revokes its sessions, and records the status change", async () => {
    await deactivateAccount(actor, account.id);

    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: { id: account.id },
      data: { status: "INACTIVE" },
      include: { person: true },
    });
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { accountId: account.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.auditEventCreate.mock.calls[0]?.[0].data).toMatchObject({
      actorId: actor.id,
      targetType: "Account",
      targetId: account.id,
      action: "DEACTIVATE",
      before: { status: "ACTIVE" },
      after: { status: "INACTIVE" },
    });
  });

  it("stores a new password hash, revokes existing sessions, and audits without the password", async () => {
    const newPassword = "nova-senha-qa";

    await resetAccountPassword(actor, account.id, newPassword);

    const savedPasswordHash = mocks.accountUpdate.mock.calls[0]?.[0].data.passwordHash;
    expect(await verifyPassword(savedPasswordHash, newPassword)).toBe(true);
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { accountId: account.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    const audit = mocks.auditEventCreate.mock.calls[0]?.[0].data;
    expect(audit).toMatchObject({
      actorId: actor.id,
      targetType: "Account",
      targetId: account.id,
      action: "PASSWORD_RESET",
    });
    expect(JSON.stringify(audit)).not.toContain(newPassword);
    expect(JSON.stringify(audit)).not.toContain("passwordHash");
  });
});
