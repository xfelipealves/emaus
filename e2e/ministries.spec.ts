import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("ministry administration", () => {
  const username = "t21-ministry-admin";

  test.beforeAll(async () => {
    const previousMinistries = await prisma.ministry.findMany({ where: { name: { startsWith: "Ministério E2E T21" } }, select: { id: true } });
    const previousMinistryIds = previousMinistries.map((ministry) => ministry.id);
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: previousMinistryIds } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: previousMinistryIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: previousMinistryIds } } });
    await prisma.account.deleteMany({ where: { username } });
    const account = await prisma.account.create({
      data: {
        username,
        email: `${username}@example.test`,
        passwordHash: await hashPassword("senha-t21-valida"),
        role: "ADMINISTRATOR",
        person: { create: { fullName: "Administrador T21 E2E" } },
      },
    });
    expect(account.status).toBe("ACTIVE");
  });

  test.afterAll(async () => {
    const ministries = await prisma.ministry.findMany({ where: { name: { startsWith: "Ministério E2E T21" } }, select: { id: true } });
    const ministryIds = ministries.map((ministry) => ministry.id);
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: ministryIds } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: ministryIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: ministryIds } } });
    const account = await prisma.account.findUnique({ where: { username } });
    if (account) {
      await prisma.account.delete({ where: { id: account.id } });
      await prisma.person.delete({ where: { id: account.personId } });
    }
    await prisma.$disconnect();
  });

  test("creates, edits and archives a ministry", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill("senha-t21-valida");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/ministerios");

    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Criar Ministério" }) });
    await createForm.getByLabel("Nome", { exact: true }).fill("Ministério E2E T21");
    await createForm.getByLabel(/Descrição/).fill("Descrição E2E");
    await page.getByRole("button", { name: "Criar Ministério" }).click();
    await expect(page.getByRole("heading", { name: "Ministério E2E T21" })).toBeVisible();

    const ministryCard = page.getByRole("article").filter({ hasText: "Ministério E2E T21" });
    await ministryCard.getByLabel("Nome", { exact: true }).fill("Ministério E2E T21 atualizado");
    await ministryCard.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("heading", { name: "Ministério E2E T21 atualizado" })).toBeVisible();

    const updatedMinistryCard = page.getByRole("heading", { name: "Ministério E2E T21 atualizado" }).locator("xpath=ancestor::article");
    page.on("dialog", (dialog) => dialog.accept());
    await updatedMinistryCard.getByRole("button", { name: "Arquivar Ministério" }).click();
    await expect(updatedMinistryCard.getByText("Arquivado")).toBeVisible();
    await expect(updatedMinistryCard.getByRole("button", { name: "Arquivar Ministério" })).toHaveCount(0);
  });
});
