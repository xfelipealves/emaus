import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), getSession: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => { throw new Error(`REDIRECT:${destination}`); },
}));
vi.mock("@/features/auth/session-service", () => ({ getSession: mocks.getSession }));

describe("settings entry route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session-token" }) });
  });

  it("sends administrators to user and account settings", async () => {
    mocks.getSession.mockResolvedValue({ id: "admin-1", role: "ADMINISTRATOR" });

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/configuracoes/usuarios");
  });

  it("keeps non-administrators out of the administrative settings route", async () => {
    mocks.getSession.mockResolvedValue({ id: "secretary-1", role: "SECRETARY" });

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/");
  });
});
