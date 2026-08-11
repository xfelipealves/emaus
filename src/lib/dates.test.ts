import { describe, expect, it } from "vitest";
import {
  calculateAge,
  formatDateOnly,
  formatDateInBrazil,
  parseDateTimeInput,
  parseDateInput,
} from "./dates";

describe("Brazil date utilities", () => {
  it("calculates age before and on the birthday in Sao Paulo", () => {
    const birthDate = parseDateInput("2000-08-08");

    expect(calculateAge(birthDate, new Date("2026-08-07T23:00:00.000Z"))).toBe(25);
    expect(calculateAge(birthDate, new Date("2026-08-08T03:00:00.000Z"))).toBe(26);
  });

  it("returns no age when birth date is absent", () => {
    expect(calculateAge(null, new Date("2026-08-08T03:00:00.000Z"))).toBeNull();
  });

  it("parses and formats business dates using the Brazil timezone", () => {
    const date = parseDateInput("2026-08-08");

    expect(formatDateInBrazil(date)).toBe("08/08/2026");
    expect(formatDateOnly(new Date("1990-08-11T00:00:00.000Z"))).toBe("11/08/1990");
  });

  it("converts local Sao Paulo date-times to exact instants", () => {
    expect(parseDateTimeInput("2026-09-10T19:00")).toEqual(new Date("2026-09-10T22:00:00.000Z"));
  });
});
