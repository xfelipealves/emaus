import { describe, expect, it } from "vitest";
import { recurrenceDates } from "./series-service";

describe("meeting recurrence", () => {
  it("generates weekly dates only on selected ISO weekdays", () => {
    const dates = recurrenceDates({ recurrence: "WEEKLY", weekdays: [1, 3], startDate: new Date("2026-01-05T00:00:00.000Z"), endDate: null }, new Date("2026-01-12T00:00:00.000Z"));
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-05T12:00:00.000Z",
      "2026-01-07T12:00:00.000Z",
      "2026-01-12T12:00:00.000Z",
    ]);
  });

  it("skips alternating weeks for biweekly recurrence and honors end date", () => {
    const dates = recurrenceDates({ recurrence: "BIWEEKLY", weekdays: [1], startDate: new Date("2026-01-05T00:00:00.000Z"), endDate: new Date("2026-01-26T00:00:00.000Z") }, new Date("2026-02-02T00:00:00.000Z"));
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-05T12:00:00.000Z",
      "2026-01-19T12:00:00.000Z",
    ]);
  });

  it("generates selected weekdays once per month", () => {
    const dates = recurrenceDates({ recurrence: "MONTHLY", weekdays: [1], startDate: new Date("2026-01-05T00:00:00.000Z"), endDate: null }, new Date("2026-02-28T00:00:00.000Z"));
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-05T12:00:00.000Z",
      "2026-01-12T12:00:00.000Z",
      "2026-01-19T12:00:00.000Z",
      "2026-01-26T12:00:00.000Z",
      "2026-02-02T12:00:00.000Z",
      "2026-02-09T12:00:00.000Z",
      "2026-02-16T12:00:00.000Z",
      "2026-02-23T12:00:00.000Z",
    ]);
  });
});
