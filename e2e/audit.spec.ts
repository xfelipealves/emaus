import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("audit history", () => {
  test.describe.configure({ mode: "serial" });
  const adminUsername = "t33-e2e-admin";
  const secretaryUsername = "t33-e2e-secretary";
  const targetName = "Pessoa auditada E2E T33";
  let targetId: string;

  test.beforeAll(async () => {
    const admin = await prisma.account.upsert({
      where: { username: adminUsername },
      create: { username: adminUsername, email: `${adminUsername}@example.test`, passwordHash: await hashPassword("senha-t33-admin"), role: "ADMINISTRATOR", person: { create: { fullName: "Administrador E2E T33" } } },
      update: { passwordHash: await hashPassword("senha-t33-admin"), status: "ACTIVE" },
    });
    await prisma.account.upsert({
      where: { username: secretaryUsername },
      create: { username: secretaryUsername, email: `${secretaryUsername}@example.test`, passwordHash: await hashPassword("senha-t33-secretaria"), role: "SECRETARY", person: { create: { fullName: "Secretaria E2E T33" } } },
      update: { passwordHash: await hashPassword("senha-t33-secretaria"), status: "ACTIVE" },
    });
    await prisma.auditEvent.deleteMany({ where: { actorId: admin.id } });
    const target = await prisma.person.create({ data: { fullName: targetName } });
    targetId = target.id;
    await prisma.auditEvent.create({ data: { actorId: admin.id, targetType: "Attendance", targetId, action: "CORRECTION", before: { status: "PRESENT" }, after: { status: "ABSENT" }, reason: "Correção solicitada" } });
  });

  test.afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { targetId } });
    await prisma.account.deleteMany({ where: { username: { in: [adminUsername, secretaryUsername] } } });
    await prisma.person.deleteMany({ where: { fullName: { in: ["Administrador E2E T33", "Secretaria E2E T33", targetName] } } });
    await prisma.$disconnect();
  });

  async function login(page: Page, username: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  }

  test("administrator sees sensitive audit details and correction reason", async ({ page }) => {
    await login(page, adminUsername, "senha-t33-admin");
    await page.goto("/configuracoes/auditoria");
    await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible();
    const auditRecord = page.getByRole("article").filter({ hasText: `Attendance · ${targetId}` });
    await expect(auditRecord.getByRole("heading", { name: `Attendance · ${targetId}` })).toBeVisible();
    await expect(auditRecord.getByText("Administrador E2E T33")).toBeVisible();
    await expect(auditRecord.getByText("CORRECTION", { exact: true })).toBeVisible();
    await expect(auditRecord.getByText('"status": "PRESENT"')).toBeVisible();
    await expect(auditRecord.getByText('"status": "ABSENT"')).toBeVisible();
    await expect(auditRecord.getByText("Correção solicitada")).toBeVisible();
  });

  test("non-administrator cannot access audit history", async ({ page }) => {
    await login(page, secretaryUsername, "senha-t33-secretaria");
    await page.goto("/configuracoes/auditoria");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Auditoria" })).toHaveCount(0);
  });
});
