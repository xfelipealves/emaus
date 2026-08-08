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
    await prisma.noteVersion.deleteMany({ where: { note: { personId: { in: oldPeople.map(({ id }) => id) } } } });
    await prisma.note.deleteMany({ where: { personId: { in: oldPeople.map(({ id }) => id) } } });
    await prisma.person.deleteMany({ where: { id: { in: oldPeople.map(({ id }) => id) } } });
    await prisma.ministry.deleteMany({ where: { id: { in: oldMinistries.map(({ id }) => id) } } });
    const ministry = await prisma.ministry.create({ data: { name: ministryName } });
    const person = await prisma.person.create({ data: { fullName: personName, status: "MEMBER", phone: "(11) 99999-0000", birthDate: new Date("1990-08-11T00:00:00.000Z"), memberships: { create: { ministryId: ministry.id, role: "MEMBER", startDate: new Date("2024-01-01T12:00:00.000Z") } } } });
    await prisma.timelineEvent.createMany({
      data: [
        { personId: person.id, category: "STATUS", title: "Status alterado T30", occurredAt: new Date("2026-08-08T10:00:00.000Z") },
        { personId: person.id, category: "NOTE", title: "Nota adicionada T30", occurredAt: new Date("2026-08-08T11:00:00.000Z") },
        { personId: person.id, category: "CORRECTION", title: "Presença corrigida T30", occurredAt: new Date("2026-08-08T12:00:00.000Z") },
      ],
    });
  });

  test.afterAll(async () => {
    const people = await prisma.person.findMany({ where: { fullName: { in: [personName, "Administrador Perfil T20", "Líder Perfil T20"] } }, select: { id: true } });
    await prisma.noteVersion.deleteMany({ where: { note: { personId: { in: people.map(({ id }) => id) } } } });
    await prisma.note.deleteMany({ where: { personId: { in: people.map(({ id }) => id) } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: people.map(({ id }) => id) } } });
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

  test("orders timeline newest first and applies category filters", async ({ page }) => {
    await login(page, adminUsername, "senha-t20-admin");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    await page.goto(`/pessoas/${person.id}/timeline`);
    await expect(page.getByRole("heading", { name: `Timeline de ${personName}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Presença corrigida T30" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nota adicionada T30" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status alterado T30" })).toBeVisible();

    await page.getByRole("link", { name: "Notas" }).click();
    await expect(page).toHaveURL(/filter=notes/);
    await expect(page.getByRole("heading", { name: "Nota adicionada T30" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status alterado T30" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Presença corrigida T30" })).toHaveCount(0);
  });

  test("creates and edits a versioned note from the profile", async ({ page }) => {
    await login(page, adminUsername, "senha-t20-admin");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    await page.goto(`/pessoas/${person.id}`);

    await page.getByLabel("Nova nota").fill("Primeiro registro T31");
    await page.getByRole("button", { name: "Adicionar nota" }).click();
    await expect(page.getByText("Nota adicionada.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nota", exact: true })).toHaveValue("Primeiro registro T31");

    await page.getByRole("textbox", { name: "Nota", exact: true }).fill("Registro atualizado T31");
    await page.getByRole("button", { name: "Salvar edição" }).click();
    await expect(page.getByText("Nota atualizada.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nota", exact: true })).toHaveValue("Registro atualizado T31");
    await expect(prisma.noteVersion.count({ where: { note: { personId: person.id } } })).resolves.toBe(2);
  });

  test("archives a note and reveals it only through the archived filter", async ({ page }) => {
    await login(page, adminUsername, "senha-t20-admin");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    await page.goto(`/pessoas/${person.id}`);
    await page.getByLabel("Nova nota").fill("Registro arquivado T32");
    await page.getByRole("button", { name: "Adicionar nota" }).click();
    await expect(page.getByText("Nota adicionada.")).toBeVisible();
    page.on("dialog", (dialog) => dialog.accept());
    await page.locator("textarea").first().locator("xpath=../..").getByRole("button", { name: "Arquivar" }).click();
    await expect.poll(async () => prisma.note.findFirst({ where: { personId: person.id, content: "Registro arquivado T32" }, select: { archived: true } })).toEqual({ archived: true });
    await page.reload();
    await expect(page.getByText("Registro arquivado T32")).toHaveCount(0);

    await page.getByRole("link", { name: "Arquivadas" }).click();
    await expect(page).toHaveURL(/notes=archived/);
    await expect(page.getByRole("textbox", { name: "Nota", exact: true })).toHaveValue("Registro arquivado T32");
    await expect(prisma.note.count({ where: { personId: person.id, content: "Registro arquivado T32", archived: true } })).resolves.toBe(1);
  });
});
