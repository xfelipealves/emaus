import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateSeriesForm, EditSeriesForm, GenerateSeriesOccurrencesForm } from "./series-forms";

vi.mock("./actions", () => ({
  createSeriesAction: vi.fn(),
  updateSeriesAction: vi.fn(),
  generateSeriesOccurrencesAction: vi.fn(),
}));

const options = {
  categories: [{ id: "cat-1", name: "Cultos" }],
  ministries: [{ id: "min-1", name: "Música" }, { id: "min-2", name: "Jovens" }],
};

describe("recurring series forms", () => {
  it("offers recurrence patterns, selected weekdays, and ministry or whole-church audiences", () => {
    const markup = renderToStaticMarkup(<CreateSeriesForm {...options} />);

    expect(markup).toContain("Nova série recorrente");
    expect(markup).toContain("Semanal");
    expect(markup).toContain("Quinzenal");
    expect(markup).toContain("Mensal");
    expect(markup).toContain('name="weekdays"');
    expect(markup).toContain('name="audience"');
    expect(markup).toContain("Toda a igreja");
    expect(markup).toContain("Ministérios selecionados");
    expect(markup).toContain("Música");
    expect(markup).toContain("Jovens");
  });

  it("prefills an existing series and lets the administrator extend its occurrence horizon", () => {
    const series = {
      id: "series-1",
      name: "Encontro semanal",
      categoryId: "cat-1",
      recurrence: "BIWEEKLY" as const,
      weekdays: [1, 3],
      startDate: new Date("2026-01-05T12:00:00.000Z"),
      endDate: null,
      ministryIds: ["min-1"],
      category: { id: "cat-1", name: "Cultos" },
      audiences: [{ ministryId: "min-1", ministry: { name: "Música", status: "ACTIVE" as const } }],
      _count: { meetings: 4 },
    };
    const editMarkup = renderToStaticMarkup(<EditSeriesForm {...options} series={series} />);
    const generateMarkup = renderToStaticMarkup(<GenerateSeriesOccurrencesForm seriesId="series-1" seriesName="Encontro semanal" />);

    expect(editMarkup).toContain('name="seriesId"');
    expect(editMarkup).toContain('value="series-1"');
    expect(editMarkup).toContain('value="Encontro semanal"');
    expect(editMarkup).toContain("Quinzenal");
    expect(editMarkup).toContain("4 encontro(s) gerado(s)");
    expect(generateMarkup).toContain('name="throughDate"');
    expect(generateMarkup).toContain("Gerar encontros até");
  });

  it("keeps a previously selected archived Ministry visible and selected while editing", () => {
    const series = {
      id: "series-archived",
      name: "Série histórica",
      categoryId: "cat-1",
      recurrence: "WEEKLY" as const,
      weekdays: [1],
      startDate: new Date("2026-01-05T12:00:00.000Z"),
      endDate: null,
      ministryIds: ["legacy"],
      category: { id: "cat-1", name: "Cultos" },
      audiences: [{ ministryId: "legacy", ministry: { name: "Ministério histórico", status: "ARCHIVED" as const } }],
      _count: { meetings: 1 },
    };
    const markup = renderToStaticMarkup(<EditSeriesForm {...options} series={series} />);

    expect(markup).toContain("Ministério histórico (arquivado)");
    expect(markup).toContain('value="legacy"');
    expect(markup).toContain("checked");
  });
});
