import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("responsive application shell", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const username = `t13-shell-${testInfo.title.includes("mobile") ? "mobile" : "desktop"}`;
    await prisma.account.upsert({
      where: { username },
      create: {
        username,
        email: `${username}@example.test`,
        passwordHash: await hashPassword("senha-t13-shell"),
        person: { create: { fullName: `Pessoa ${username}` } },
      },
      update: { passwordHash: await hashPassword("senha-t13-shell"), status: "ACTIVE" },
    });
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill("senha-t13-shell");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test.afterEach(async ({}, testInfo) => {
    const username = `t13-shell-${testInfo.title.includes("mobile") ? "mobile" : "desktop"}`;
    await prisma.account.deleteMany({ where: { username } });
    await prisma.person.deleteMany({ where: { fullName: `Pessoa ${username}` } });
  });

  test("desktop exposes all primary areas and marks home as active", async ({ page }) => {
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
    for (const label of ["Início", "Pessoas", "Ministérios", "Encontros", "Configurações"]) {
      await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  });

  test("mobile keeps operational areas in bottom navigation and places settings under Mais", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const navigation = page.getByRole("navigation", { name: "Navegação móvel" });
    await expect(navigation).toBeVisible();
    for (const label of ["Início", "Pessoas", "Ministérios", "Encontros", "Mais"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeHidden();
    await expect(navigation.getByRole("link", { name: "Mais" })).toHaveAttribute("href", "/configuracoes");
  });

  test("dashboard shortcuts and person cancellation keep internal destinations", async ({ page }) => {
    const shortcuts = page.getByRole("region", { name: "Atalhos rápidos" });
    await expect(shortcuts.getByRole("link", { name: /Cadastrar pessoa/ })).toHaveAttribute("href", "/pessoas");
    await expect(shortcuts.getByRole("link", { name: /Criar encontro/ })).toHaveAttribute("href", "/encontros");
    await expect(shortcuts.getByRole("link", { name: /Lançar frequência/ })).toHaveAttribute("href", "/encontros");

    await page.goto("/pessoas/nova");
    await page.getByRole("link", { name: "Cancelar" }).click();
    await expect(page).toHaveURL(/\/pessoas$/);
  });
});
