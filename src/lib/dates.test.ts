import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  ageFrom,
  daysUntilBirthday,
  isoDateInTz,
  weekdayOfIso,
  zonedToUtc,
} from "./dates";

describe("dates", () => {
  it("converte horário de Brasília para UTC", () => {
    expect(zonedToUtc("2026-11-08", "19:00", "America/Sao_Paulo").toISOString()).toBe(
      "2026-11-08T22:00:00.000Z",
    );
  });

  it("data civil no fuso não vira o dia seguinte à noite", () => {
    expect(isoDateInTz(new Date("2026-11-09T02:30:00Z"), "America/Sao_Paulo")).toBe(
      "2026-11-08",
    );
  });

  it("calcula idade antes e depois do aniversário", () => {
    expect(ageFrom("1990-11-10", "2026-11-09")).toBe(35);
    expect(ageFrom("1990-11-09", "2026-11-09")).toBe(36);
    expect(ageFrom(null, "2026-11-09")).toBeNull();
  });

  it("dias até o aniversário atravessam o ano", () => {
    expect(daysUntilBirthday("2000-11-09", "2026-11-09")).toBe(0);
    expect(daysUntilBirthday("2000-01-01", "2026-12-31")).toBe(1);
    expect(daysUntilBirthday("2000-02-29", "2027-02-27")).toBe(1);
  });

  it("soma dias e dia da semana", () => {
    expect(addDaysIso("2026-12-30", 3)).toBe("2027-01-02");
    expect(weekdayOfIso("2026-11-08")).toBe(0);
  });
});
