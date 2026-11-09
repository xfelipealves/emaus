import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./page";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getSession: vi.fn(),
  listAccounts: vi.fn(),
  listPeopleWithoutAccounts: vi.fn(),
  listLeaderScopeConfiguration: vi.fn(),
  listMinistries: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: (destination: string) => { throw new Error(`REDIRECT:${destination}`); } }));
vi.mock("@/features/auth/session-service", () => ({ getSession: mocks.getSession }));
vi.mock("@/features/auth/account-service", () => ({
  listAccounts: mocks.listAccounts,
  listPeopleWithoutAccounts: mocks.listPeopleWithoutAccounts,
}));
vi.mock("@/features/ministerios/access-scope-service", () => ({
  listLeaderScopeConfiguration: mocks.listLeaderScopeConfiguration,
}));
vi.mock("@/features/ministerios/ministry-service", () => ({ listMinistries: mocks.listMinistries }));
vi.mock("./account-forms", () => ({
  CreateAccountForm: () => null,
  DeactivateAccountForm: () => null,
}));
vi.mock("./account-reset-form", () => ({ AccountResetForm: () => null }));
vi.mock("./ministry-access-panel", () => ({
  MinistryAccessPanel: ({ leaders, ministries }: { leaders: Array<{ id: string }>; ministries: Array<{ name: string }> }) => (
    <section aria-label="F2 ministry access">F2-PANEL:{leaders.map(({ id }) => id).join(",")}|{ministries.map(({ name }) => name).join(",")}</section>
  ),
}));

describe("users page ministry panel integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session-token" }) });
    mocks.getSession.mockResolvedValue({ id: "admin-1", role: "ADMINISTRATOR" });
    mocks.listAccounts.mockResolvedValue([]);
    mocks.listPeopleWithoutAccounts.mockResolvedValue([]);
    mocks.listLeaderScopeConfiguration.mockResolvedValue([{
      id: "leader-qa",
      username: "qa-leader",
      status: "ACTIVE",
      person: { fullName: "Líder QA" },
      ministryAccess: [],
    }]);
    mocks.listMinistries.mockResolvedValue([
      { id: "ministry-qa", name: "QA Ministério", status: "ACTIVE" },
      { id: "ministry-archived", name: "Arquivo", status: "ARCHIVED" },
    ]);
  });

  it("passes the configured leaders and only active ministries to the Frente 2 panel", async () => {
    const markup = renderToStaticMarkup(await UsersPage());

    expect(markup).toContain("F2-PANEL:leader-qa|QA Ministério");
    expect(markup).not.toContain("Arquivo");
  });
});
