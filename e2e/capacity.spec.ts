import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

const sessionCount = 20;
const password = "emaus-synthetic-capacity-test";

test("RNF-001 @capacity serves 500 synthetic people to 20 concurrent authenticated sessions", async ({ browser }) => {
  test.setTimeout(180_000);

  expect(await prisma.person.count()).toBe(500);
  expect(await prisma.account.count({ where: { username: { startsWith: "capacity-user-" } } })).toBe(sessionCount);

  const sessions: Array<{ close: () => Promise<void>; page: import("@playwright/test").Page }> = [];
  try {
    for (let index = 1; index <= sessionCount; index += 1) {
      const number = String(index).padStart(2, "0");
      const context = await browser.newContext();
      const page = await context.newPage();
      sessions.push({ close: () => context.close(), page });

      await page.goto("/login");
      await page.getByLabel("Nome de usuário").fill(`capacity-user-${number}`);
      await page.getByLabel("Senha").fill(password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    }

    const durations = await Promise.all(
      sessions.map(async ({ page }) => {
        const startedAt = performance.now();
        await page.goto("/pessoas?status=all");
        await expect(page.getByRole("heading", { name: "Pessoas", exact: true })).toBeVisible({ timeout: 30_000 });
        return Math.round(performance.now() - startedAt);
      }),
    );

    const sorted = [...durations].sort((left, right) => left - right);
    const p50 = sorted[Math.ceil(sorted.length * 0.5) - 1];
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    console.log(`CAPACITY_RESULT ${JSON.stringify({
      people: await prisma.person.count(),
      simultaneousAuthenticatedSessions: sessions.length,
      concurrentRoute: "/pessoas?status=all",
      p50Ms: p50,
      p95Ms: p95,
      maxMs: sorted.at(-1),
      serverMode: "production",
      database: "temporary loopback PostgreSQL",
    })}`);
  } finally {
    await Promise.all(sessions.map(({ close }) => close()));
    await prisma.$disconnect();
  }
});
