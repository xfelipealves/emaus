import { expect, test } from "@playwright/test";

test("dashboard redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta." })).toBeVisible();
});
