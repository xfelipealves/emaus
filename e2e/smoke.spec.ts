import { expect, test } from "@playwright/test";

test("home page renders the Emaús identity", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Emaús");
  await expect(page.getByRole("heading", { name: "A comunidade em um só lugar." })).toBeVisible();
});
