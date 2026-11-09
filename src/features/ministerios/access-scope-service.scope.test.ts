import { beforeEach, describe, expect, it, vi } from "vitest";
import { grantMinistryAccess, revokeMinistryAccess } from "./access-scope-service";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  ministryFindUnique: vi.fn(),
  accessFindUnique: vi.fn(),
  accessCreate: vi.fn(),
  accessUpdate: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("../../server/transaction", () => ({
  withTransaction: (work: (transaction: unknown) => unknown) => work({
    account: { findUnique: mocks.accountFindUnique },
    ministry: { findUnique: mocks.ministryFindUnique },
    accountMinistryAccess: {
      findUnique: mocks.accessFindUnique,
      create: mocks.accessCreate,
      update: mocks.accessUpdate,
    },
  }),
}));

vi.mock("../../server/audit", () => ({ recordAuditEvent: mocks.recordAuditEvent }));

describe("leader ministry scope changes", () => {
  const admin = { id: "admin-1", role: "ADMINISTRATOR" as const };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindUnique.mockResolvedValue({ id: "leader-1", role: "LEADER" });
    mocks.ministryFindUnique.mockResolvedValue({ id: "music", status: "ACTIVE" });
    mocks.accessFindUnique.mockResolvedValue(null);
    mocks.accessCreate.mockResolvedValue({
      id: "access-1",
      accountId: "leader-1",
      ministryId: "music",
      grantedAt: new Date("2026-09-01T00:00:00.000Z"),
      revokedAt: null,
    });
    mocks.accessUpdate.mockResolvedValue({
      id: "access-1",
      accountId: "leader-1",
      ministryId: "music",
      grantedAt: new Date("2026-09-01T00:00:00.000Z"),
      revokedAt: new Date("2026-09-02T00:00:00.000Z"),
    });
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it("grants an active ministry to a leader and writes an audit event", async () => {
    const access = await grantMinistryAccess(admin, { accountId: "leader-1", ministryId: "music" });

    expect(mocks.accessCreate).toHaveBeenCalledWith({ data: { accountId: "leader-1", ministryId: "music" } });
    expect(access).toMatchObject({ accountId: "leader-1", ministryId: "music", revokedAt: null });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "GRANT", targetId: "access-1" }));
  });

  it("revokes an existing grant without deleting it and writes an audit event", async () => {
    mocks.accessFindUnique.mockResolvedValue({
      id: "access-1",
      accountId: "leader-1",
      ministryId: "music",
      grantedAt: new Date("2026-09-01T00:00:00.000Z"),
      revokedAt: null,
    });

    const access = await revokeMinistryAccess(admin, { accountId: "leader-1", ministryId: "music" });

    expect(mocks.accessUpdate).toHaveBeenCalledWith({ where: { id: "access-1" }, data: { revokedAt: expect.any(Date) } });
    expect(access.revokedAt).toBeInstanceOf(Date);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "REVOKE", targetId: "access-1" }));
  });

  it("rejects an invalid grant target before creating access", async () => {
    mocks.accountFindUnique.mockResolvedValue({ id: "secretary-1", role: "SECRETARY" });

    await expect(grantMinistryAccess(admin, { accountId: "secretary-1", ministryId: "music" })).rejects.toThrow("só podem ser concedidos a líderes");
    expect(mocks.accessCreate).not.toHaveBeenCalled();
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });
});
