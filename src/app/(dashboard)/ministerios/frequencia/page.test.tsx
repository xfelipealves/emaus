import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FrequencyPage from "./page";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getSession: vi.fn(),
  getMeetingActor: vi.fn(),
  parsePeriod: vi.fn(),
  getFrequencyReport: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/session-service", () => ({ getSession: mocks.getSession }));
vi.mock("@/features/encontros/meeting-service", () => ({ getMeetingActor: mocks.getMeetingActor }));
vi.mock("@/features/ministerios/frequency-report", () => ({
  parseFrequencyReportPeriod: mocks.parsePeriod,
  getMinistryFrequencyReport: mocks.getFrequencyReport,
}));

describe("Ministry frequency report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session" }) });
    mocks.getSession.mockResolvedValue({ id: "account-1", role: "ADMINISTRATOR" });
    mocks.getMeetingActor.mockResolvedValue({ id: "account-1", role: "ADMINISTRATOR", ministryAccess: [] });
    mocks.getFrequencyReport.mockResolvedValue([]);
  });

  it("does not query or present totals until both filter dates are valid", async () => {
    mocks.parsePeriod.mockReturnValue({ kind: "incomplete" });

    const markup = renderToStaticMarkup(await FrequencyPage({ searchParams: Promise.resolve({ from: "2026-05-01" }) }));

    expect(markup).toContain("Escolha a data inicial e a data final para consultar a frequência.");
    expect(markup).not.toContain("Presentes");
    expect(mocks.getFrequencyReport).not.toHaveBeenCalled();
  });

  it("passes a valid selected period to the report service", async () => {
    const period = { kind: "valid", start: new Date("2026-05-01T03:00:00.000Z"), endExclusive: new Date("2026-06-01T03:00:00.000Z") } as const;
    mocks.parsePeriod.mockReturnValue(period);
    mocks.getFrequencyReport.mockResolvedValue([
      { ministryId: "music", ministryName: "Música", totals: { NOT_CONFIRMED: 2, PRESENT: 5, ABSENT: 1 } },
    ]);

    const markup = renderToStaticMarkup(await FrequencyPage({ searchParams: Promise.resolve({ from: "2026-05-01", to: "2026-05-31" }) }));

    expect(mocks.getFrequencyReport).toHaveBeenCalledWith(
      { id: "account-1", role: "ADMINISTRATOR", ministryAccess: [] },
      { start: period.start, endExclusive: period.endExclusive },
    );
    expect(markup).toContain("Música");
    expect(markup).toContain("Não confirmados");
  });
});
