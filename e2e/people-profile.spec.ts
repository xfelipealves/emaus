import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";
import { calculateAge } from "../src/lib/dates";

test.describe("person profile", () => {
  test.describe.configure({ mode: "serial" });
  const adminUsername = "t20-profile-admin";
  const leaderUsername = "t20-profile-leader";
  const personName = "Pessoa Perfil T20";
  const promotionVisitorName = "Visitante para promoção T20";
  const ministryName = "Ministério Perfil T20";
  const meetingName = "Encontro Perfil T20";
  const birthDate = new Date("1990-08-11T00:00:00.000Z");
  let categoryId: string;
  let meetingId: string;

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
    const oldPeople = await prisma.person.findMany({ where: { fullName: { in: [personName, promotionVisitorName] } }, select: { id: true } });
    const oldMinistries = await prisma.ministry.findMany({ where: { name: ministryName }, select: { id: true } });
    await prisma.ministryMembership.deleteMany({ where: { OR: [{ personId: { in: oldPeople.map(({ id }) => id) } }, { ministryId: { in: oldMinistries.map(({ id }) => id) } }] } });
    await prisma.noteVersion.deleteMany({ where: { note: { personId: { in: oldPeople.map(({ id }) => id) } } } });
    await prisma.note.deleteMany({ where: { personId: { in: oldPeople.map(({ id }) => id) } } });
    await prisma.person.deleteMany({ where: { id: { in: oldPeople.map(({ id }) => id) } } });
    await prisma.ministry.deleteMany({ where: { id: { in: oldMinistries.map(({ id }) => id) } } });
    const ministry = await prisma.ministry.create({ data: { name: ministryName } });
    const person = await prisma.person.create({ data: { fullName: personName, status: "MEMBER", phone: "(11) 99999-0000", birthDate, memberships: { create: { ministryId: ministry.id, role: "MEMBER", startDate: new Date("2024-01-01T12:00:00.000Z") } } } });
    const category = await prisma.category.create({ data: { name: "Categoria Perfil T20" } });
    categoryId = category.id;
    const meeting = await prisma.meeting.create({ data: { categoryId, title: meetingName, scheduledAt: new Date("2026-08-10T22:00:00.000Z"), status: "SCHEDULED", attendances: { create: { personId: person.id, status: "PRESENT" } } } });
    meetingId = meeting.id;
    await prisma.timelineEvent.createMany({
      data: [
        { personId: person.id, category: "STATUS", title: "Status alterado T30", occurredAt: new Date("2026-08-08T10:00:00.000Z") },
        { personId: person.id, category: "NOTE", title: "Nota adicionada T30", occurredAt: new Date("2026-08-08T11:00:00.000Z") },
        { personId: person.id, category: "CORRECTION", title: "Presença corrigida T30", occurredAt: new Date("2026-08-08T12:00:00.000Z") },
      ],
    });
  });

  test.afterAll(async () => {
    const people = await prisma.person.findMany({ where: { fullName: { in: [personName, promotionVisitorName, "Administrador Perfil T20", "Líder Perfil T20"] } }, select: { id: true } });
    await prisma.noteVersion.deleteMany({ where: { note: { personId: { in: people.map(({ id }) => id) } } } });
    await prisma.note.deleteMany({ where: { personId: { in: people.map(({ id }) => id) } } });
    await prisma.attendance.deleteMany({ where: { meetingId } });
    await prisma.meeting.delete({ where: { id: meetingId } });
    await prisma.category.delete({ where: { id: categoryId } });
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
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  }

  function currentBrazilDateInputValue() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  }

  test("shows essential data, initials, ministry and overview tabs", async ({ page }) => {
    await login(page, adminUsername, "senha-t20-admin");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    await page.goto(`/pessoas/${person.id}`);
    await expect(page.getByRole("heading", { name: personName })).toBeVisible();
    await expect(page.getByText("Membro", { exact: true })).toBeVisible();
    await expect(page.getByText("(11) 99999-0000")).toBeVisible();
    const expectedAge = calculateAge(birthDate);
    if (expectedAge === null) throw new Error("A idade da fixture de perfil deveria ser calculável");
    await expect(page.getByText(`11/08/1990 · ${expectedAge} anos`)).toBeVisible();
    await expect(page.getByLabel(`Iniciais de ${personName}`)).toHaveText("PP");
    await expect(page.getByText(ministryName)).toBeVisible();
    const frequency = page.getByRole("region", { name: "Histórico de frequência" });
    await expect(frequency).toContainText(meetingName);
    await expect(frequency).toContainText("10/08/2026");
    await expect(frequency).toContainText("Presente");
    await expect(page.getByRole("navigation", { name: "Abas do perfil" })).toContainText("Timeline");
  });

  test("blocks a leader without a granted ministry scope", async ({ page }) => {
    await login(page, leaderUsername, "senha-t20-leader");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    const response = await page.goto(`/pessoas/${person.id}`);
    expect(response?.status()).toBe(404);
  });

  test("promotes a visitor with required data and an editable default effective date", async ({ page }) => {
    const visitor = await prisma.person.create({ data: { fullName: promotionVisitorName } });
    await login(page, adminUsername, "senha-t20-admin");
    await page.goto(`/pessoas/${visitor.id}`);

    const effectiveDate = page.getByLabel("Data efetiva da promoção");
    await expect(effectiveDate).toHaveValue(currentBrazilDateInputValue());
    await effectiveDate.fill("2024-03-12");
    await page.getByLabel("Telefone para promoção").fill("(11) 98888-2020");
    await page.getByLabel("Data de nascimento para promoção").fill("1998-02-22");
    await page.getByRole("button", { name: "Promover a membro" }).click();

    await expect(page).toHaveURL(new RegExp(`/pessoas/${visitor.id}\\?status=promoted$`));
    await expect(page.getByText("Pessoa promovida a membro.")).toBeVisible();
    await expect(page.locator("dd").nth(0)).toHaveText("(11) 98888-2020");
    await expect(page.locator("dd").nth(1)).toContainText("22/02/1998");
    await expect(prisma.person.findUnique({ where: { id: visitor.id } })).resolves.toMatchObject({ status: "MEMBER", phone: "(11) 98888-2020" });

    await page.getByRole("link", { name: "Timeline" }).click();
    await expect(page).toHaveURL(new RegExp(`/pessoas/${visitor.id}/timeline$`));
    await expect(page.getByRole("heading", { name: "Pessoa promovida a membro" })).toBeVisible();
    await expect(page.locator("time").filter({ hasText: "12/03/2024" })).toBeVisible();
  });

  test("orders timeline newest first and applies category filters", async ({ page }) => {
    await login(page, adminUsername, "senha-t20-admin");
    const person = await prisma.person.findFirstOrThrow({ where: { fullName: personName } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/pessoas/${person.id}`);
    const timelineLink = page.getByRole("link", { name: "Timeline" });
    const receivesTap = await timelineLink.evaluate((link) => {
      const bounds = link.getBoundingClientRect();
      const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      return target === link || (target instanceof Element && link.contains(target));
    });
    expect(receivesTap).toBe(true);
    await timelineLink.click();
    await expect(page).toHaveURL(new RegExp(`/pessoas/${person.id}/timeline$`));
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
