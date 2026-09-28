import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrequencyReportView } from "./frequency-report-view";

describe("frequency report view", () => {
  it("offers inclusive start and end date filters", () => {
    const markup = renderToStaticMarkup(<FrequencyReportView from="2026-05-01" to="2026-05-31" period={{ kind: "incomplete" }} />);

    expect(markup).toContain('name="from"');
    expect(markup).toContain('name="to"');
    expect(markup).toContain('type="date"');
    expect(markup).toContain("Data inicial");
    expect(markup).toContain("Data final");
    expect(markup).toContain("Aplicar período");
  });

  it("does not present totals before both period dates are selected", () => {
    const markup = renderToStaticMarkup(<FrequencyReportView from="2026-05-01" to="" period={{ kind: "incomplete" }} />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Escolha a data inicial e a data final para consultar a frequência.");
    expect(markup).not.toContain("Presentes");
  });

  it("shows the invalid period state as an alert", () => {
    const markup = renderToStaticMarkup(<FrequencyReportView
      from="2026-05-03"
      to="2026-05-02"
      period={{ kind: "invalid", message: "A data final deve ser igual ou posterior à data inicial." }}
    />);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("A data final deve ser igual ou posterior à data inicial.");
    expect(markup).not.toContain("Presentes");
  });

  it("shows the agreed frequency counts grouped by Ministry", () => {
    const markup = renderToStaticMarkup(<FrequencyReportView
      from="2026-05-01"
      to="2026-05-31"
      period={{ kind: "valid", start: new Date("2026-05-01T03:00:00.000Z"), endExclusive: new Date("2026-06-01T03:00:00.000Z") }}
      summaries={[
        { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 2, PRESENT: 5, ABSENT: 1 } },
      ]}
    />);

    expect(markup).toContain("Música");
    expect(markup).toContain("Presentes");
    expect(markup).toContain(">5</dd>");
    expect(markup).toContain("Ausentes");
    expect(markup).toContain(">1</dd>");
    expect(markup).toContain("Não confirmados");
    expect(markup).toContain(">2</dd>");
  });
});
