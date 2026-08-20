import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("people list", () => {
  const username = "t19-people-list-admin";
  const names = ["Pessoa Visitante T19", "Pessoa Membro T19", "Pessoa Inativa T19"];

  test.beforeAll(async () => {
    await prisma.account.upsert({
      where: { username },
      create: {
        username,
        email: `${username}@example.test`,
        passwordHash: await hashPassword("senha-t19-valida"),
        role: "ADMINISTRATOR",
        person: { create: { fullName: "Administrador Lista T19" } },
      },
      update: { passwordHash: await hashPassword("senha-t19-valida"), status: "ACTIVE" },
    });
    await prisma.person.deleteMany({ where: { fullName: { in: names } } });
    await prisma.person.createMany({
      data: [
        { fullName: names[0], status: "VISITOR" },
        { fullName: names[1], status: "MEMBER", birthDate: new Date("1990-08-10T00:00:00.000Z") },
        { fullName: names[2], status: "INACTIVE" },
      ],
    });
  });

  test.afterAll(async () => {
    await prisma.account.deleteMany({ where: { username } });
    await prisma.person.deleteMany({ where: { fullName: { in: [...names, "Administrador Lista T19"] } } });
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill("senha-t19-valida");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/pessoas");
  });

  test("filters people by status and searches by name", async ({ page }) => {
    await expect(page.getByText("Pessoa Visitante T19")).toBeVisible();
    await page.getByRole("link", { name: "Membros" }).click();
    await expect(page.getByText("Pessoa Membro T19")).toBeVisible();
    await expect(page.getByText("Pessoa Visitante T19")).not.toBeVisible();

    await page.goto("/pessoas?status=all");
    await page.getByLabel("Buscar por nome").fill("inativa");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("Pessoa Inativa T19")).toBeVisible();
    await expect(page.getByText("Pessoa Membro T19")).not.toBeVisible();
  });
});
