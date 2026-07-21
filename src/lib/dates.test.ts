import { describe, expect, it } from "vitest";

import { calculateAge, formatBusinessDate } from "./dates";

describe("business date utilities", () => {
  it("calculates age from the local Sao Paulo birthday boundary", () => {
    const birthDate = new Date("2000-07-22T03:00:00.000Z");

    expect(calculateAge(birthDate, new Date("2026-07-22T02:59:59.000Z"))).toBe(25);
    expect(calculateAge(birthDate, new Date("2026-07-22T03:00:00.000Z"))).toBe(26);
  });

  it("does not invent age without a birth date and formats in Sao Paulo time", () => {
    expect(calculateAge(null, new Date("2026-07-22T03:00:00.000Z"))).toBeNull();
    expect(formatBusinessDate(new Date("2026-07-22T02:30:00.000Z"))).toBe("21/07/2026");
  });
});
