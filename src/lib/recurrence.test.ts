import { describe, expect, it } from "vitest";
import { occurrences } from "./recurrence";

describe("occurrences", () => {
  it("semanal a partir do primeiro dia da semana correto", () => {
    expect(
      occurrences({ recurrence: "weekly", weekday: 0, startDate: "2026-11-04", from: "2026-11-01", until: "2026-11-30" }),
    ).toEqual(["2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
  });

  it("quinzenal respeita a janela", () => {
    expect(
      occurrences({ recurrence: "biweekly", weekday: 3, startDate: "2026-11-04", from: "2026-11-10", until: "2026-12-10" }),
    ).toEqual(["2026-11-18", "2026-12-02"]);
  });

  it("mensal mantém o n-ésimo dia da semana", () => {
    expect(
      occurrences({ recurrence: "monthly", weekday: 0, startDate: "2026-11-01", from: "2026-11-01", until: "2027-02-28" }),
    ).toEqual(["2026-11-01", "2026-12-06", "2027-01-03", "2027-02-07"]);
  });
});
