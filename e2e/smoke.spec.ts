import { expect, test } from "@playwright/test";

test("loads the Emaús foundation page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Emaús" })).toBeVisible();
});
