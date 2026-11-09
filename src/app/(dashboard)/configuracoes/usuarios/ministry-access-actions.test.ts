import { beforeEach, describe, expect, it, vi } from "vitest";
import { grantMinistryAccessAction, revokeMinistryAccessAction } from "./ministry-access-actions";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getSession: vi.fn(),
  grantMinistryAccess: vi.fn(),
  revokeMinistryAccess: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/auth/session-service", () => ({ getSession: mocks.getSession }));
vi.mock("@/features/ministerios/access-scope-service", () => ({
  grantMinistryAccess: mocks.grantMinistryAccess,
  revokeMinistryAccess: mocks.revokeMinistryAccess,
}));
vi.mock("@/lib/session", () => ({ SESSION_COOKIE_NAME: "emaus-session" }));

function formData(values: Record<string, unknown>) {
  return { get: (key: string) => values[key] ?? null } as FormData;
}

describe("ministry access server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session-token" }) });
    mocks.getSession.mockResolvedValue({ id: "admin-1", role: "ADMINISTRATOR" });
    mocks.grantMinistryAccess.mockResolvedValue({ id: "access-1" });
    mocks.revokeMinistryAccess.mockResolvedValue({ id: "access-1" });
  });

  it("rejects missing IDs on the server without calling the grant service", async () => {
    const state = await grantMinistryAccessAction({}, formData({ accountId: " ", ministryId: "music" }));

    expect(state).toEqual({ error: "Selecione um Líder." });
    expect(mocks.grantMinistryAccess).not.toHaveBeenCalled();
  });

  it("requires an administrator before revoking access", async () => {
    mocks.getSession.mockResolvedValue({ id: "secretary-1", role: "SECRETARY" });

    const state = await revokeMinistryAccessAction({}, formData({ accountId: "leader-1", ministryId: "music" }));

    expect(state).toEqual({ error: "Apenas administradores podem gerenciar escopos ministeriais." });
    expect(mocks.revokeMinistryAccess).not.toHaveBeenCalled();
  });

  it("passes validated values to the grant service and invalidates the listing", async () => {
    const state = await grantMinistryAccessAction({}, formData({ accountId: " leader-1 ", ministryId: " music " }));

    expect(state).toEqual({ success: "Acesso concedido ao Ministério." });
    expect(mocks.grantMinistryAccess).toHaveBeenCalledWith(
      { id: "admin-1", role: "ADMINISTRATOR" },
      { accountId: "leader-1", ministryId: "music" },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ministerios");
  });

  it("passes validated values to the revoke service", async () => {
    const state = await revokeMinistryAccessAction({}, formData({ accountId: "leader-1", ministryId: "music" }));

    expect(state).toEqual({ success: "Acesso revogado. O histórico foi preservado." });
    expect(mocks.revokeMinistryAccess).toHaveBeenCalledWith(
      { id: "admin-1", role: "ADMINISTRATOR" },
      { accountId: "leader-1", ministryId: "music" },
    );
  });
});
