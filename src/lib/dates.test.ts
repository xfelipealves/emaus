import { describe, expect, it } from "vitest";
import {
  calculateAge,
  formatDateInBrazil,
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
  });
});
