import { expect, test } from "@playwright/test";

test("loads the responsive application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Cuide das pessoas/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toContainText("Pessoas");
  await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();
});

test("moves settings under Mais on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Navegação mobile" })).toContainText("Mais");
  await expect(page.getByRole("navigation", { name: "Navegação mobile" })).not.toContainText("Configurações");
});
