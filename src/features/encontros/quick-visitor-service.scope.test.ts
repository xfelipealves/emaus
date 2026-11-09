import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerContextualVisitor } from "./quick-visitor-service";

const mocks = vi.hoisted(() => ({
  accountFindUnique: vi.fn(),
  meetingFindUnique: vi.fn(),
  personCreate: vi.fn(),
  attendanceCreate: vi.fn(),
  recordAuditEvent: vi.fn(),
  recordTimelineEvent: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: (work: (transaction: unknown) => unknown) => work({
      account: { findUnique: mocks.accountFindUnique },
      meeting: { findUnique: mocks.meetingFindUnique },
      person: { create: mocks.personCreate },
      attendance: { create: mocks.attendanceCreate },
    }),
  },
}));

vi.mock("../../server/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
  recordTimelineEvent: mocks.recordTimelineEvent,
}));

describe("contextual quick visitor scope", () => {
  const leader = { id: "leader-1", role: "LEADER" as const, ministryAccess: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountFindUnique.mockResolvedValue({
      role: "LEADER",
      status: "ACTIVE",
      ministryAccess: [{ ministryId: "music", revokedAt: null }],
    });
    mocks.meetingFindUnique.mockResolvedValue({
      status: "SCHEDULED",
      audiences: [{ ministryId: "music", ministry: { status: "ACTIVE" } }],
    });
    mocks.personCreate.mockResolvedValue({
      id: "visitor-1",
      fullName: "Visitante novo",
      status: "VISITOR",
      phone: null,
      birthDate: null,
      profilePhotoUrl: null,
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
    });
    mocks.attendanceCreate.mockResolvedValue({ personId: "visitor-1", meetingId: "meeting-1", status: "NOT_CONFIRMED" });
    mocks.recordAuditEvent.mockResolvedValue(undefined);
    mocks.recordTimelineEvent.mockResolvedValue(undefined);
  });

  it("registers a visitor in an encounter for a persisted granted ministry", async () => {
    const attendance = await registerContextualVisitor(leader, "meeting-1", " Visitante novo ");

    expect(mocks.personCreate).toHaveBeenCalledWith({ data: { fullName: "Visitante novo", status: "VISITOR" } });
    expect(mocks.attendanceCreate).toHaveBeenCalledWith({
      data: { meetingId: "meeting-1", personId: "visitor-1", status: "NOT_CONFIRMED" },
      include: { person: true },
    });
    expect(attendance).toMatchObject({ meetingId: "meeting-1", personId: "visitor-1", status: "NOT_CONFIRMED" });
  });

  it("denies an encounter outside the persisted grant before creating a visitor", async () => {
    mocks.meetingFindUnique.mockResolvedValue({
      status: "SCHEDULED",
      audiences: [{ ministryId: "youth", ministry: { status: "ACTIVE" } }],
    });

    await expect(registerContextualVisitor(leader, "meeting-outside", "Visitante sem escopo")).rejects.toThrow("Encontro não encontrado");
    expect(mocks.personCreate).not.toHaveBeenCalled();
    expect(mocks.attendanceCreate).not.toHaveBeenCalled();
  });

  it("denies a revoked grant before creating a visitor", async () => {
    mocks.accountFindUnique.mockResolvedValue({ role: "LEADER", status: "ACTIVE", ministryAccess: [] });

    await expect(registerContextualVisitor(leader, "meeting-1", "Visitante sem acesso")).rejects.toThrow("Encontro não encontrado");
    expect(mocks.personCreate).not.toHaveBeenCalled();
    expect(mocks.attendanceCreate).not.toHaveBeenCalled();
  });
});
