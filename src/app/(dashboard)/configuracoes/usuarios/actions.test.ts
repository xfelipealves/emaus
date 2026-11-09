import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAccountPasswordAction } from "./actions";
import { grantMinistryAccessAction } from "./ministry-access-actions";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getSession: vi.fn(),
  resetAccountPassword: vi.fn(),
  grantMinistryAccess: vi.fn(),
  revokeMinistryAccess: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/auth/session-service", () => ({ getSession: mocks.getSession }));
vi.mock("@/features/auth/account-service", () => ({
  resetAccountPassword: mocks.resetAccountPassword,
  createAccount: vi.fn(),
  deactivateAccount: vi.fn(),
}));
vi.mock("@/features/ministerios/access-scope-service", () => ({
  grantMinistryAccess: mocks.grantMinistryAccess,
  revokeMinistryAccess: mocks.revokeMinistryAccess,
}));

describe("administrator password reset action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: () => ({ value: "session-token" }) });
    mocks.getSession.mockResolvedValue({ id: "admin-1", role: "ADMINISTRATOR" });
    mocks.grantMinistryAccess.mockResolvedValue({ id: "access-1" });
  });

  it("resets the selected account and returns an in-place confirmation", async () => {
    const formData = new FormData();
    formData.set("accountId", "account-qa");
    formData.set("password", "nova-senha-qa");

    await expect(resetAccountPasswordAction({}, formData)).resolves.toEqual({
      success: "Senha redefinida com sucesso.",
    });
    expect(mocks.resetAccountPassword).toHaveBeenCalledWith(
      { id: "admin-1", role: "ADMINISTRATOR" },
      "account-qa",
      "nova-senha-qa",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/configuracoes/usuarios");
  });

  it("uses the Frente 2 server validation for an incomplete ministry grant", async () => {
    const formData = new FormData();
    formData.set("accountId", " ");
    formData.set("ministryId", "ministry-qa");

    await expect(grantMinistryAccessAction({}, formData)).resolves.toEqual({
      error: "Selecione um Líder.",
    });
    expect(mocks.grantMinistryAccess).not.toHaveBeenCalled();
  });

  it("rejects a non-administrator without calling the reset service", async () => {
    mocks.getSession.mockResolvedValue({ id: "secretary-1", role: "SECRETARY" });
    const formData = new FormData();
    formData.set("accountId", "account-qa");
    formData.set("password", "nova-senha-qa");

    await expect(resetAccountPasswordAction({}, formData)).resolves.toMatchObject({
      error: "Apenas administradores podem gerenciar contas.",
    });
    expect(mocks.resetAccountPassword).not.toHaveBeenCalled();
  });
});
