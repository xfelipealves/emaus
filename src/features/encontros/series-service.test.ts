import { describe, expect, it } from "vitest";
import { createSeries, normalizeSeriesInput, recurrenceDates } from "./series-service";

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

  it("generates the selected weekdays in the start date's week-of-month ordinal", () => {
    const dates = recurrenceDates({ recurrence: "MONTHLY", weekdays: [1, 3], startDate: new Date("2026-01-05T00:00:00.000Z"), endDate: null }, new Date("2026-03-10T00:00:00.000Z"));
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-01-05T12:00:00.000Z",
      "2026-01-07T12:00:00.000Z",
      "2026-02-02T12:00:00.000Z",
      "2026-02-04T12:00:00.000Z",
      "2026-03-02T12:00:00.000Z",
      "2026-03-04T12:00:00.000Z",
    ]);
  });

  it("skips months without the series' fifth selected weekday", () => {
    const dates = recurrenceDates({ recurrence: "MONTHLY", weekdays: [1], startDate: new Date("2026-03-30T00:00:00.000Z"), endDate: null }, new Date("2026-06-30T00:00:00.000Z"));
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-03-30T12:00:00.000Z",
      "2026-06-29T12:00:00.000Z",
    ]);
  });

  it("normalizes a series name and de-duplicates its weekdays and Ministry audience", () => {
    const normalized = normalizeSeriesInput({
      categoryId: "cat-1",
      name: "  Encontro dos jovens  ",
      recurrence: "BIWEEKLY",
      weekdays: [3, 1, 3],
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      ministryIds: ["youth", "youth", "music"],
    });

    expect(normalized).toMatchObject({
      name: "Encontro dos jovens",
      weekdays: [1, 3],
      ministryIds: ["youth", "music"],
      startDate: new Date("2026-01-05T12:00:00.000Z"),
      endDate: null,
    });
  });

  it("rejects an empty weekday selection and a term before the start", () => {
    const valid = {
      categoryId: "cat-1",
      name: "Encontro",
      recurrence: "WEEKLY" as const,
      weekdays: [],
      startDate: new Date("2026-01-05T00:00:00.000Z"),
    };

    expect(() => normalizeSeriesInput(valid)).toThrow("Selecione ao menos um dia da semana válido.");
    expect(() => normalizeSeriesInput({ ...valid, weekdays: [1], endDate: new Date("2026-01-04T00:00:00.000Z") })).toThrow("O término não pode anteceder o início.");
  });

  it("rejects a missing category, an unsupported recurrence, invalid dates, and non-integer weekdays", () => {
    const valid = {
      categoryId: "cat-1",
      name: "Encontro",
      recurrence: "WEEKLY" as const,
      weekdays: [1],
      startDate: new Date("2026-01-05T00:00:00.000Z"),
    };

    expect(() => normalizeSeriesInput({ ...valid, categoryId: " " })).toThrow("Categoria da série é obrigatória.");
    expect(() => normalizeSeriesInput({ ...valid, recurrence: "YEARLY" as never })).toThrow("Padrão de recorrência inválido.");
    expect(() => normalizeSeriesInput({ ...valid, startDate: new Date(Number.NaN) })).toThrow("Data inicial inválida.");
    expect(() => normalizeSeriesInput({ ...valid, weekdays: [Number.NaN] })).toThrow("Selecione ao menos um dia da semana válido.");
  });

  it("denies recurring-series management to secretaries before touching the database", async () => {
    await expect(createSeries(
      { id: "secretary", role: "SECRETARY", ministryAccess: [] },
      { categoryId: "cat-1", name: "Encontro", recurrence: "WEEKLY", weekdays: [1], startDate: new Date("2026-01-05T00:00:00.000Z") },
    )).rejects.toThrow("Apenas administradores podem gerenciar séries.");
  });
});
