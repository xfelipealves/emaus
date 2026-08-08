import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("person registration", () => {
  test.describe.configure({ mode: "serial" });
  const username = "t17-registration-admin";

  test.beforeAll(async () => {
    await prisma.account.upsert({
      where: { username },
      create: {
        username,
        email: `${username}@example.test`,
        passwordHash: await hashPassword("senha-t17-valida"),
        role: "ADMINISTRATOR",
        person: { create: { fullName: "Administrador T17" } },
      },
      update: { passwordHash: await hashPassword("senha-t17-valida"), status: "ACTIVE" },
    });
  });

  test.afterAll(async () => {
    const people = await prisma.person.findMany({
      where: { fullName: { in: ["Administrador T17", "Visitante E2E T17", "Membro E2E T17"] } },
      select: { id: true },
    });
    const personIds = people.map((person) => person.id);
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: personIds } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.account.deleteMany({ where: { username } });
    await prisma.person.deleteMany({ where: { fullName: { in: ["Administrador T17", "Visitante E2E T17", "Membro E2E T17"] } } });
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill("senha-t17-valida");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("registers a visitor with only the full name and opens its profile", async ({ page }) => {
    await page.goto("/pessoas/nova");
    await page.getByLabel("Nome completo").fill("Visitante E2E T17");
    await page.getByRole("button", { name: "Cadastrar Pessoa" }).click();

    await expect(page).not.toHaveURL(/\/pessoas\/nova$/);
    await expect(page).toHaveURL(/\/pessoas\/[^/]+$/);
    const visitorId = new URL(page.url()).pathname.split("/").pop();
    await expect(prisma.person.findUnique({ where: { id: visitorId } })).resolves.toMatchObject({
      fullName: "Visitante E2E T17",
      status: "VISITOR",
    });
  });

  test("registers a member with required contact data", async ({ page }) => {
    await page.goto("/pessoas/nova");
    await page.getByLabel("Tipo de cadastro").selectOption("member");
    await page.getByLabel("Nome completo").fill("Membro E2E T17");
    await page.getByLabel("Telefone").fill("(11) 98888-7777");
    await page.getByLabel("Data de nascimento").fill("1992-03-10");
    await page.getByRole("button", { name: "Cadastrar Pessoa" }).click();

    await expect(page).not.toHaveURL(/\/pessoas\/nova$/);
    await expect(page).toHaveURL(/\/pessoas\/[^/]+$/);
    const memberId = new URL(page.url()).pathname.split("/").pop();
    await expect(prisma.person.findUnique({ where: { id: memberId } })).resolves.toMatchObject({
      fullName: "Membro E2E T17",
      status: "MEMBER",
      phone: "(11) 98888-7777",
    });
  });
});
