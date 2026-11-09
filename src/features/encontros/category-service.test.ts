import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, updateCategory } from "./category-service";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("../../server/transaction", () => ({
  withTransaction: (work: (transaction: unknown) => unknown) => work({
    category: { create: mocks.create, findUnique: mocks.findUnique, update: mocks.update },
  }),
}));

vi.mock("../../server/audit", () => ({ recordAuditEvent: mocks.recordAuditEvent }));

describe("category administration", () => {
  const admin = { id: "admin-1", role: "ADMINISTRATOR" as const, ministryAccess: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: "category-1", name: "Cultos", description: "Celebrações" });
    mocks.findUnique.mockResolvedValue({ id: "category-1", name: "Cultos", description: null });
    mocks.update.mockResolvedValue({ id: "category-1", name: "Cultos atualizados", description: null });
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it("trims a new category before saving and records its creation", async () => {
    const created = await createCategory(admin, { name: "  Cultos  ", description: " Celebrações " });

    expect(mocks.create).toHaveBeenCalledWith({ data: { name: "Cultos", description: "Celebrações" } });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "CREATE", targetId: "category-1" }));
    expect(created).toMatchObject({ id: "category-1", name: "Cultos" });
  });

  it("updates a category in place so existing meeting references stay intact", async () => {
    await updateCategory(admin, "category-1", { name: " Cultos atualizados " });

    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "category-1" }, data: { name: "Cultos atualizados", description: null } });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "UPDATE", targetId: "category-1" }));
  });

  it("denies secretaries before attempting a category write", async () => {
    await expect(createCategory({ id: "secretary", role: "SECRETARY", ministryAccess: [] }, { name: "Negada" })).rejects.toThrow("Apenas administradores podem gerenciar categorias.");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an empty category name without starting a write", async () => {
    await expect(createCategory(admin, { name: "   " })).rejects.toThrow("Nome da categoria é obrigatório.");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
