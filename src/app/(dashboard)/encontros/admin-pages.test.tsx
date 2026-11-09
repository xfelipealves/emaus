import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MeetingCategoriesPage from "./categorias/page";
import MeetingSeriesPage from "./series/page";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getSession: vi.fn(),
  getMeetingActor: vi.fn(),
  listCategories: vi.fn(),
  listMeetingOptions: vi.fn(),
  listSeries: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: (destination: string) => { throw new Error(`REDIRECT:${destination}`); } }));
vi.mock("@/features/auth/session-service", () => ({ getSession: mocks.getSession }));
vi.mock("@/features/encontros/meeting-service", () => ({
  getMeetingActor: mocks.getMeetingActor,
  listMeetingOptions: mocks.listMeetingOptions,
}));
vi.mock("@/features/encontros/category-service", () => ({ listCategories: mocks.listCategories }));
vi.mock("@/features/encontros/series-service", () => ({ listSeries: mocks.listSeries }));
vi.mock("./actions", () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: vi.fn(),
  createSeriesAction: vi.fn(),
  updateSeriesAction: vi.fn(),
  generateSeriesOccurrencesAction: vi.fn(),
}));

describe("meeting administration pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session" }) });
    mocks.getSession.mockResolvedValue({ id: "admin-1", role: "ADMINISTRATOR" });
    mocks.getMeetingActor.mockResolvedValue({ id: "admin-1", role: "ADMINISTRATOR", ministryAccess: [] });
    mocks.listCategories.mockResolvedValue([{ id: "cat-1", name: "Cultos", description: null }]);
    mocks.listMeetingOptions.mockResolvedValue({
      categories: [{ id: "cat-1", name: "Cultos" }],
      ministries: [{ id: "music", name: "Música" }],
    });
    mocks.listSeries.mockResolvedValue([{
      id: "series-1",
      name: "Encontro semanal",
      categoryId: "cat-1",
      recurrence: "WEEKLY",
      weekdays: [1],
      startDate: new Date("2026-01-05T12:00:00.000Z"),
      endDate: null,
      category: { id: "cat-1", name: "Cultos" },
      audiences: [{ ministryId: "music", ministry: { name: "Música", status: "ACTIVE" } }],
      _count: { meetings: 2 },
    }]);
  });

  it("shows category creation and editing to administrators", async () => {
    const markup = renderToStaticMarkup(await MeetingCategoriesPage());

    expect(markup).toContain("Categorias de encontros");
    expect(markup).toContain("Cultos");
    expect(markup).toContain("Criar categoria");
    expect(markup).toContain("Salvar alterações");
  });

  it("shows series settings, audience, and occurrence generation to administrators", async () => {
    const markup = renderToStaticMarkup(await MeetingSeriesPage());

    expect(markup).toContain("Séries recorrentes");
    expect(markup).toContain("Encontro semanal");
    expect(markup).toContain("Música");
    expect(markup).toContain("Gerar encontros");
  });

  it("redirects secretaries away from both administration pages", async () => {
    mocks.getSession.mockResolvedValue({ id: "secretary-1", role: "SECRETARY" });
    mocks.getMeetingActor.mockResolvedValue({ id: "secretary-1", role: "SECRETARY", ministryAccess: [] });

    await expect(MeetingCategoriesPage()).rejects.toThrow("REDIRECT:/encontros");
    await expect(MeetingSeriesPage()).rejects.toThrow("REDIRECT:/encontros");
    expect(mocks.listCategories).not.toHaveBeenCalled();
    expect(mocks.listSeries).not.toHaveBeenCalled();
  });
});
