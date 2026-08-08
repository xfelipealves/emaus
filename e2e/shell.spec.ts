import { expect, test } from "@playwright/test";

test.describe("responsive application shell", () => {
  test("desktop exposes all primary areas and marks home as active", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
    for (const label of ["Início", "Pessoas", "Ministérios", "Encontros", "Configurações"]) {
      await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  });

  test("mobile keeps operational areas in bottom navigation and places settings under Mais", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "Navegação móvel" });
    await expect(navigation).toBeVisible();
    for (const label of ["Início", "Pessoas", "Ministérios", "Encontros", "Mais"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeHidden();
    await expect(navigation.getByRole("link", { name: "Mais" })).toHaveAttribute("href", "/configuracoes");
  });
});
