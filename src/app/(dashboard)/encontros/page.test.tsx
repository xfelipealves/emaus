import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MeetingsPage from "./page";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getSession: vi.fn(),
  getMeetingActor: vi.fn(),
  listMeetingOptions: vi.fn(),
  listMeetings: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/auth/session-service", () => ({ getSession: mocks.getSession }));
vi.mock("@/features/encontros/meeting-service", () => ({
  getMeetingActor: mocks.getMeetingActor,
  listMeetingOptions: mocks.listMeetingOptions,
  listMeetings: mocks.listMeetings,
}));

describe("meetings administration links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session" }) });
    mocks.getSession.mockResolvedValue({ id: "account-1", role: "ADMINISTRATOR" });
    mocks.getMeetingActor.mockResolvedValue({ id: "account-1", role: "ADMINISTRATOR", ministryAccess: [] });
    mocks.listMeetingOptions.mockResolvedValue({ categories: [], ministries: [] });
    mocks.listMeetings.mockResolvedValue([]);
  });

  it("shows category and recurring-series administration to administrators", async () => {
    const markup = renderToStaticMarkup(await MeetingsPage());

    expect(markup).toContain('href="/encontros/categorias"');
    expect(markup).toContain('href="/encontros/series"');
  });

  it("does not show administration links to secretaries", async () => {
    mocks.getSession.mockResolvedValue({ id: "account-2", role: "SECRETARY" });
    mocks.getMeetingActor.mockResolvedValue({ id: "account-2", role: "SECRETARY", ministryAccess: [] });

    const markup = renderToStaticMarkup(await MeetingsPage());

    expect(markup).not.toContain('href="/encontros/categorias"');
    expect(markup).not.toContain('href="/encontros/series"');
  });
});
