import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await prisma.account.upsert({
    where: { username: "t13-admin" },
    create: {
      username: "t13-admin",
      email: "t13-admin@example.test",
      passwordHash: await hashPassword("senha-t13-valida"),
      role: "ADMINISTRATOR",
      person: { create: { fullName: "Administrador E2E T13" } },
    },
    update: {
      passwordHash: await hashPassword("senha-t13-valida"),
      status: "ACTIVE",
    },
  });
});

test.afterAll(async () => {
  await prisma.account.deleteMany({ where: { username: "t13-admin" } });
  await prisma.person.deleteMany({ where: { fullName: "Administrador E2E T13" } });
  await prisma.$disconnect();
});

test("valid credentials reach the protected dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t13-admin");
  await page.getByLabel("Senha").fill("senha-t13-valida");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "A comunidade em um só lugar." })).toBeVisible();
});

test("invalid credentials show generic feedback and stay on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("t13-admin");
  await page.getByLabel("Senha").fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Nome de usuário ou senha inválidos.")).toBeVisible();
});
