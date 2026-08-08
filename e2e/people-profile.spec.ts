import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("person profile", () => {
  test.describe.configure({ mode: "serial" });
  const adminUsername = "t20-profile-admin";
  const leaderUsername = "t20-profile-leader";
  const personName = "Pessoa Perfil T20";
  const ministryName = "Ministério Perfil T20";

  test.beforeAll(async () => {
    await prisma.account.upsert({
      where: { username: adminUsername },
      create: { username: adminUsername, email: `${adminUsername}@example.test`, passwordHash: await hashPassword("senha-t20-admin"), role: "ADMINISTRATOR", person: { create: { fullName: "Administrador Perfil T20" } } },
      update: { passwordHash: await hashPassword("senha-t20-admin"), status: "ACTIVE" },
    });
    await prisma.account.upsert({
      where: { username: leaderUsername },
      create: { username: leaderUsername, email: `${leaderUsername}@example.test`, passwordHash: await hashPassword("senha-t20-leader"), role: "LEADER", person: { create: { fullName: "Líder Perfil T20" } } },
      update: { passwordHash: await hashPassword("senha-t20-leader"), status: "ACTIVE" },
    });
    const oldPeople = await prisma.person.findMany({ where: { fullName: personName }, select: { id: true } });
    const oldMinistries = await prisma.ministry.findMany({ where: { name: ministryName }, select: { id: true } });
    await prisma.ministryMembership.deleteMany({ where: { OR: [{ personId: { in: oldPeople.map(({ id }) => id) } }, { ministryId: { in: oldMinistries.map(({ id }) => id) } }] } });
    await prisma.person.deleteMany({ where: { id: { in: oldPeople.map(({ id }) => id) } } });
    await prisma.ministry.deleteMany({ where: { id: { in: oldMinistries.map(({ id }) => id) } } });
    const ministry = await prisma.ministry.create({ data: { name: ministryName } });
    await prisma.person.create({ data: { fullName: personName, status: "MEMBER", phone: "(11) 99999-0000", birthDate: new Date("1990-08-11T00:00:00.000Z"), memberships: { create: { ministryId: ministry.id, role: "MEMBER", startDate: new Date("2024-01-01T12:00:00.000Z") } } } });
  });

  test.afterAll(async () => {
    const people = await prisma.person.findMany({ where: { fullName: { in: [personName, "Administrador Perfil T20", "Líder Perfil T20"] } }, select: { id: true } });
    await prisma.ministryMembership.deleteMany({ where: { personId: { in: people.map(({ id }) => id) } } });
    await prisma.account.deleteMany({ where: { username: { in: [adminUsername, leaderUsername] } } });
    await prisma.ministry.deleteMany({ where: { name: ministryName } });
    await prisma.person.deleteMany({ where: { id: { in: people.map(({ id }) => id) } } });
    await prisma.$disconnect();
  });

  async function login(page: Page, username: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  }

  test("shows essential data, initials, ministry and overview tabs", async ({ page }) => {
    await login(page, adminUsername, "senha-t20-admin");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    await page.goto(`/pessoas/${person.id}`);
    await expect(page.getByRole("heading", { name: personName })).toBeVisible();
    await expect(page.getByText("Membro", { exact: true })).toBeVisible();
    await expect(page.getByText("(11) 99999-0000")).toBeVisible();
    await expect(page.getByText("10/08/1990 · 35 anos")).toBeVisible();
    await expect(page.getByLabel(`Iniciais de ${personName}`)).toHaveText("PP");
    await expect(page.getByText(ministryName)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Abas do perfil" })).toContainText("Timeline");
  });

  test("blocks a leader without a granted ministry scope", async ({ page }) => {
    await login(page, leaderUsername, "senha-t20-leader");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    const response = await page.goto(`/pessoas/${person.id}`);
    expect(response?.status()).toBe(404);
  });
});
