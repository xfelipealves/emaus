import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMinistryFrequencyReport } from "./frequency-report";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  ministryFindMany: vi.fn(),
  meetingFindMany: vi.fn(),
  membershipFindMany: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    account: { findUnique: mocks.accountFindUnique },
    ministry: { findMany: mocks.ministryFindMany },
    meeting: { findMany: mocks.meetingFindMany },
    ministryMembership: { findMany: mocks.membershipFindMany },
  },
}));

describe("ministry frequency report scope", () => {
  const period = { start: new Date("2026-05-01T03:00:00.000Z"), endExclusive: new Date("2026-06-01T03:00:00.000Z") };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindUnique.mockResolvedValue({ role: "LEADER", status: "ACTIVE", ministryAccess: [{ ministryId: "music" }] });
    mocks.ministryFindMany.mockResolvedValue([{ id: "music", name: "Música", status: "ACTIVE" }]);
    mocks.meetingFindMany.mockResolvedValue([
      {
        scheduledAt: new Date("2026-05-02T15:00:00.000Z"),
        status: "SCHEDULED",
        audiences: [{ ministryId: "music" }, { ministryId: "youth" }],
        attendances: [{ personId: "visitor", status: "PRESENT" }],
      },
      {
        scheduledAt: new Date("2026-05-03T15:00:00.000Z"),
        status: "SCHEDULED",
        audiences: [],
        attendances: [{ personId: "member", status: "NOT_CONFIRMED" }],
      },
    ]);
    mocks.membershipFindMany.mockResolvedValue([
      { personId: "member", ministryId: "music", startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: null },
      { personId: "member", ministryId: "youth", startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: null },
    ]);
  });

  it("limits leaders to active Ministries in their current grant for targeted and whole-church meetings", async () => {
    const summaries = await getMinistryFrequencyReport(
      { id: "leader", role: "LEADER", ministryAccess: [{ ministryId: "music", revokedAt: null }] },
      period,
    );

    expect(mocks.ministryFindMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", accountAccess: { some: { accountId: "leader", revokedAt: null } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    expect(mocks.membershipFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ministryId: { in: ["music"] } }),
    }));
    expect(mocks.meetingFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        scheduledAt: { gte: period.start, lt: period.endExclusive },
        status: { not: "CANCELLED" },
      },
    }));
    expect(summaries).toEqual([
      { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 1, PRESENT: 1, ABSENT: 0 } },
    ]);
  });

  it("keeps the Ministry query empty for a disabled account", async () => {
    mocks.accountFindUnique.mockResolvedValue({ role: "LEADER", status: "INACTIVE", ministryAccess: [{ ministryId: "music" }] });

    const summaries = await getMinistryFrequencyReport(
      { id: "leader", role: "LEADER", ministryAccess: [{ ministryId: "music", revokedAt: null }] },
      period,
    );

    expect(summaries).toEqual([]);
    expect(mocks.ministryFindMany).not.toHaveBeenCalled();
    expect(mocks.meetingFindMany).not.toHaveBeenCalled();
  });

  it.each(["ADMINISTRATOR", "SECRETARY"] as const)("keeps archived history visible to %s", async (role) => {
    mocks.accountFindUnique.mockResolvedValue({ role, status: "ACTIVE", ministryAccess: [] });
    mocks.ministryFindMany.mockResolvedValue([
      { id: "music", name: "Música", status: "ACTIVE" },
      { id: "legacy", name: "Ministério histórico", status: "ARCHIVED" },
    ]);
    mocks.meetingFindMany.mockResolvedValue([]);

    const summaries = await getMinistryFrequencyReport({ id: "account", role, ministryAccess: [] }, period);

    expect(mocks.ministryFindMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
    expect(summaries.map((summary) => summary.ministryId)).toEqual(["music", "legacy"]);
    expect(summaries.every((summary) => Object.values(summary.totals).every((count) => count === 0))).toBe(true);
  });
});
