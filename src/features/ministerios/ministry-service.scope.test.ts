import { beforeEach, describe, expect, it, vi } from "vitest";
import { listMinistries } from "./ministry-service";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  ministryFindMany: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    account: { findUnique: mocks.accountFindUnique },
    ministry: { findMany: mocks.ministryFindMany },
  },
}));

describe("ministry listing scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindUnique.mockResolvedValue({ role: "LEADER", status: "ACTIVE", ministryAccess: [{ ministryId: "music" }] });
    mocks.ministryFindMany.mockResolvedValue([{ id: "music", name: "Música", status: "ACTIVE" }]);
  });

  it("lists active ministries by the leader's persisted current grant", async () => {
    const ministries = await listMinistries({ id: "leader-1", role: "LEADER", ministryAccess: [] });

    expect(ministries.map(({ id, name }) => ({ id, name }))).toEqual([{ id: "music", name: "Música" }]);
    expect(mocks.ministryFindMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", accountAccess: { some: { accountId: "leader-1", revokedAt: null } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  });

  it("does not list ministries when the persisted account is inactive or its role changed", async () => {
    mocks.accountFindUnique.mockResolvedValueOnce({ role: "LEADER", status: "INACTIVE" });

    await expect(listMinistries({ id: "leader-1", role: "LEADER", ministryAccess: [] })).resolves.toEqual([]);
    expect(mocks.ministryFindMany).not.toHaveBeenCalled();

    mocks.accountFindUnique.mockResolvedValueOnce({ role: "SECRETARY", status: "ACTIVE" });
    await expect(listMinistries({ id: "leader-1", role: "LEADER", ministryAccess: [] })).resolves.toEqual([]);
    expect(mocks.ministryFindMany).not.toHaveBeenCalled();
  });
});
