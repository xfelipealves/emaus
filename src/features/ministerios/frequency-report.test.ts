import { describe, expect, it } from "vitest";
import { parseFrequencyReportPeriod, summarizeMinistryFrequency } from "./frequency-report";

describe("frequency report period", () => {
  it("uses inclusive São Paulo calendar dates for the selected period", () => {
    expect(parseFrequencyReportPeriod("2026-05-02", "2026-05-03")).toEqual({
      kind: "valid",
      start: new Date("2026-05-02T03:00:00.000Z"),
      endExclusive: new Date("2026-05-04T03:00:00.000Z"),
    });
  });

  it("keeps the report pending until both dates are selected", () => {
    expect(parseFrequencyReportPeriod("2026-05-02", "")).toEqual({ kind: "incomplete" });
  });

  it("rejects an end date before the start date", () => {
    expect(parseFrequencyReportPeriod("2026-05-03", "2026-05-02")).toEqual({
      kind: "invalid",
      message: "A data final deve ser igual ou posterior à data inicial.",
    });
  });

  it("rejects malformed calendar dates", () => {
    expect(parseFrequencyReportPeriod("2026-02-30", "2026-03-02")).toEqual({
      kind: "invalid",
      message: "Data inválida.",
    });
  });

  it("includes whole-church attendance for ministries with a link valid on the meeting date", () => {
    const result = summarizeMinistryFrequency(
      [
        { id: "music", name: "Música" },
        { id: "youth", name: "Jovens" },
      ],
      [
        {
          scheduledAt: new Date("2026-05-02T21:00:00.000Z"),
          status: "SCHEDULED",
          audiences: [],
          attendances: [
            { personId: "current", status: "PRESENT" },
            { personId: "youth-member", status: "ABSENT" },
            { personId: "ended", status: "NOT_CONFIRMED" },
            { personId: "future", status: "PRESENT" },
          ],
        },
      ],
      [
        { personId: "current", ministryId: "music", startDate: new Date("2026-05-02T00:00:00.000Z"), endDate: new Date("2026-05-02T00:00:00.000Z") },
        { personId: "youth-member", ministryId: "youth", startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: null },
        { personId: "ended", ministryId: "music", startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: new Date("2026-05-01T00:00:00.000Z") },
        { personId: "future", ministryId: "music", startDate: new Date("2026-05-03T00:00:00.000Z"), endDate: null },
      ],
    );

    expect(result).toEqual([
      { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 0, PRESENT: 1, ABSENT: 0 } },
      { ministryId: "youth", ministryName: "Jovens", totals: { NOT_CONFIRMED: 0, PRESENT: 0, ABSENT: 1 } },
    ]);
  });

  it("counts all records for a ministry-specific meeting, including an unlinked visitor", () => {
    expect(summarizeMinistryFrequency(
      [{ id: "music", name: "Música" }],
      [{
        scheduledAt: new Date("2026-05-02T15:00:00.000Z"),
        status: "SCHEDULED",
        audiences: [{ ministryId: "music" }],
        attendances: [{ personId: "visitor", status: "NOT_CONFIRMED" }],
      }],
      [],
    )).toEqual([
      { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 1, PRESENT: 0, ABSENT: 0 } },
    ]);
  });

  it("counts a meeting for every selected Ministry and does not require membership for its audience", () => {
    expect(summarizeMinistryFrequency(
      [
        { id: "music", name: "Música" },
        { id: "youth", name: "Jovens" },
        { id: "care", name: "Cuidado" },
      ],
      [{
        scheduledAt: new Date("2026-05-02T15:00:00.000Z"),
        status: "SCHEDULED",
        audiences: [{ ministryId: "music" }, { ministryId: "youth" }],
        attendances: [
          { personId: "visitor", status: "PRESENT" },
          { personId: "member", status: "ABSENT" },
          { personId: "pending", status: "NOT_CONFIRMED" },
        ],
      }],
      [],
    )).toEqual([
      { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 1, PRESENT: 1, ABSENT: 1 } },
      { ministryId: "youth", ministryName: "Jovens", totals: { NOT_CONFIRMED: 1, PRESENT: 1, ABSENT: 1 } },
      { ministryId: "care", ministryName: "Cuidado", totals: { NOT_CONFIRMED: 0, PRESENT: 0, ABSENT: 0 } },
    ]);
  });

  it("attributes whole-church attendance once per Ministry with memberships valid on the São Paulo meeting date", () => {
    expect(summarizeMinistryFrequency(
      [
        { id: "music", name: "Música" },
        { id: "youth", name: "Jovens" },
        { id: "care", name: "Cuidado" },
      ],
      [{
        scheduledAt: new Date("2026-05-03T02:59:00.000Z"),
        status: "SCHEDULED",
        audiences: [],
        attendances: [
          { personId: "multi", status: "PRESENT" },
          { personId: "ended-today", status: "ABSENT" },
          { personId: "starts-tomorrow", status: "NOT_CONFIRMED" },
          { personId: "unlinked", status: "PRESENT" },
        ],
      }],
      [
        { personId: "multi", ministryId: "music", startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: null },
        { personId: "multi", ministryId: "music", startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: null },
        { personId: "multi", ministryId: "youth", startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: null },
        { personId: "ended-today", ministryId: "music", startDate: new Date("2026-01-01T00:00:00.000Z"), endDate: new Date("2026-05-02T00:00:00.000Z") },
        { personId: "starts-tomorrow", ministryId: "music", startDate: new Date("2026-05-03T00:00:00.000Z"), endDate: null },
      ],
    )).toEqual([
      { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 0, PRESENT: 1, ABSENT: 1 } },
      { ministryId: "youth", ministryName: "Jovens", totals: { NOT_CONFIRMED: 0, PRESENT: 1, ABSENT: 0 } },
      { ministryId: "care", ministryName: "Cuidado", totals: { NOT_CONFIRMED: 0, PRESENT: 0, ABSENT: 0 } },
    ]);
  });

  it("excludes cancelled meetings from every ministry total", () => {
    expect(summarizeMinistryFrequency(
      [{ id: "music", name: "Música" }],
      [{
        scheduledAt: new Date("2026-05-02T15:00:00.000Z"),
        status: "CANCELLED",
        audiences: [{ ministryId: "music" }],
        attendances: [{ personId: "member", status: "PRESENT" }],
      }],
      [],
    )).toEqual([
      { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 0, PRESENT: 0, ABSENT: 0 } },
    ]);
  });
});
