import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSeriesOccurrences, updateSeries } from "./series-service";

const mocks = vi.hoisted(() => ({
  categoryFindUnique: vi.fn(),
  ministryFindMany: vi.fn(),
  seriesFindUnique: vi.fn(),
  seriesUpdate: vi.fn(),
  meetingFindFirst: vi.fn(),
  meetingCreate: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("../../server/transaction", () => ({
  withTransaction: (work: (transaction: unknown) => unknown) => work({
    category: { findUnique: mocks.categoryFindUnique },
    ministry: { findMany: mocks.ministryFindMany },
    meetingSeries: { findUnique: mocks.seriesFindUnique, update: mocks.seriesUpdate },
    meeting: { findFirst: mocks.meetingFindFirst, create: mocks.meetingCreate },
  }),
}));

vi.mock("../../server/audit", () => ({ recordAuditEvent: mocks.recordAuditEvent }));

describe("recurring series management", () => {
  const admin = { id: "admin-1", role: "ADMINISTRATOR" as const, ministryAccess: [] };
  const series = {
    id: "series-1",
    categoryId: "category-1",
    name: "Encontro de música",
    recurrence: "WEEKLY" as const,
    weekdays: [1],
    startDate: new Date("2026-01-05T12:00:00.000Z"),
    endDate: null,
    audiences: [{ ministryId: "music" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.categoryFindUnique.mockResolvedValue({ id: "category-1", name: "Cultos" });
    mocks.ministryFindMany.mockResolvedValue([{ id: "music", status: "ACTIVE" }]);
    mocks.seriesFindUnique.mockResolvedValue(series);
    mocks.seriesUpdate.mockResolvedValue(series);
    mocks.meetingFindFirst.mockResolvedValue(null);
    mocks.meetingCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "meeting-1", ...data }));
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it("copies the saved Ministry audience into each generated occurrence and stays idempotent", async () => {
    mocks.meetingFindFirst.mockResolvedValueOnce(null).mockResolvedValue({ id: "meeting-1", seriesId: "series-1" });

    const first = await generateSeriesOccurrences(admin, "series-1", new Date("2026-01-05T00:00:00.000Z"));
    const second = await generateSeriesOccurrences(admin, "series-1", new Date("2026-01-05T00:00:00.000Z"));

    expect(mocks.meetingCreate).toHaveBeenCalledTimes(1);
    expect(mocks.meetingCreate).toHaveBeenCalledWith({
      data: {
        categoryId: "category-1",
        seriesId: "series-1",
        title: "Encontro de música",
        scheduledAt: new Date("2026-01-05T12:00:00.000Z"),
        status: "DRAFT",
        audiences: { create: [{ ministryId: "music" }] },
      },
    });
    expect(first).toHaveLength(1);
    expect(second).toEqual([{ id: "meeting-1", seriesId: "series-1" }]);
  });

  it("preserves an existing archived audience when editing a series, but will not generate new occurrences for it", async () => {
    const archivedSeries = { ...series, audiences: [{ ministryId: "legacy" }] };
    mocks.seriesFindUnique.mockResolvedValue(archivedSeries);
    mocks.ministryFindMany.mockResolvedValue([{ id: "legacy", status: "ARCHIVED" }]);
    mocks.seriesUpdate.mockResolvedValue(archivedSeries);

    await updateSeries(admin, "series-1", {
      categoryId: "category-1",
      name: "Encontro de música atualizado",
      recurrence: "WEEKLY",
      weekdays: [1],
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      ministryIds: ["legacy"],
    });

    expect(mocks.seriesUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Encontro de música atualizado",
        audiences: { deleteMany: {}, create: [{ ministryId: "legacy" }] },
      }),
    }));

    await expect(generateSeriesOccurrences(admin, "series-1", new Date("2026-01-05T00:00:00.000Z"))).rejects.toThrow("A série inclui Ministério arquivado.");
    expect(mocks.meetingCreate).not.toHaveBeenCalled();
  });
});
