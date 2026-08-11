import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD, DEMO_SCENARIO_IDS } from "./demo-fixtures";
import { prisma } from "../src/lib/prisma";

test.describe("P1 role and ministry permissions", () => {
  test.describe.configure({ mode: "serial" });

  async function login(page: Page, username: string) {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  }

  test("AUTH-02/MIN-02 — leader sees the granted ministry and denies an out-of-scope Person", async ({ page }) => {
    const member = await prisma.person.findUniqueOrThrow({ where: { id: DEMO_SCENARIO_IDS.people.member } });
    const other = await prisma.person.findUniqueOrThrow({ where: { id: DEMO_SCENARIO_IDS.people.otherMinistry } });

    await login(page, "demo-leader");
    await page.goto(`/pessoas/${member.id}`);
    await expect(page.getByRole("heading", { name: member.fullName })).toBeVisible();
    await page.goto(`/encontros/${DEMO_SCENARIO_IDS.meetings.scheduled}`);
    await expect(page.getByRole("heading", { name: "Demo Encontro de Comunidade" })).toBeVisible();
    const denied = await page.goto(`/pessoas/${other.id}`);
    expect(denied?.status()).toBe(404);
  });

  test("AUTH-02 — secretary cannot open administrator settings while administrator can", async ({ page }) => {
    await login(page, "demo-secretary");
    await page.goto("/configuracoes/usuarios");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "A comunidade em um só lugar." })).toBeVisible();

    await login(page, "demo-admin");
    await page.goto("/configuracoes/usuarios");
    await expect(page.getByRole("heading", { name: "Usuários e acessos" })).toBeVisible();
    await page.goto("/configuracoes/auditoria");
    await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible();
  });
});
