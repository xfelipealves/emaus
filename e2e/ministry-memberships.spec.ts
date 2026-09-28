import { expect, test, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "./demo-fixtures";
import { prisma } from "../src/lib/prisma";

test.describe("ministry membership administration", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now().toString();
  const ministryName = `Ministério E2E vínculos ${suffix}`;
  const personName = `Pessoa E2E vínculos ${suffix}`;
  const invalidDatePersonName = `Pessoa E2E data futura ${suffix}`;
  let ministryId: string;
  let personId: string;
  let invalidDatePersonId: string;

  test.beforeAll(async () => {
    const ministry = await prisma.ministry.create({ data: { name: ministryName } });
    const person = await prisma.person.create({ data: { fullName: personName, status: "MEMBER" } });
    const invalidDatePerson = await prisma.person.create({ data: { fullName: invalidDatePersonName, status: "MEMBER" } });
    ministryId = ministry.id;
    personId = person.id;
    invalidDatePersonId = invalidDatePerson.id;
  });

  test.afterAll(async () => {
    const memberships = await prisma.ministryMembership.findMany({ where: { ministryId }, select: { id: true } });
    await prisma.auditEvent.deleteMany({ where: { targetType: "MinistryMembership", targetId: { in: memberships.map(({ id }) => id) } } });
    await prisma.timelineEvent.deleteMany({ where: { personId } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId } });
    await prisma.ministry.deleteMany({ where: { id: ministryId } });
    await prisma.person.deleteMany({ where: { id: { in: [personId, invalidDatePersonId] } } });
    await prisma.$disconnect();
  });

  async function login(page: Page, username: string) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  }

  test("Admin reaches membership management from the Ministry profile", async ({ page }) => {
    await login(page, "demo-admin");
    await page.goto("/ministerios", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: ministryName, exact: true }).click();
    await expect(page.getByRole("heading", { name: ministryName })).toBeVisible();

    const manageLink = page.getByRole("link", { name: "Gerenciar vínculos" });
    await expect(manageLink).toBeVisible();
    await expect(manageLink).toHaveAttribute("href", `/ministerios/${ministryId}/vinculos`);
    await manageLink.click();

    await expect(page).toHaveURL(new RegExp(`/ministerios/${ministryId}/vinculos$`));
    await expect(page.getByRole("heading", { name: "Gerenciar vínculos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vínculos atuais" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Histórico de vínculos" })).toBeVisible();

    const entryDate = page.getByLabel("Data de entrada");
    await expect(entryDate).toHaveValue(currentBrazilDateInputValue());
    await page.getByLabel("Pessoa").selectOption(personId);
    await page.getByLabel("Cargo ministerial").selectOption("MEMBER");
    await entryDate.fill("2026-01-10");
    await page.getByRole("button", { name: "Vincular pessoa" }).click();
    await expect(page.getByRole("status")).toContainText("Vínculo criado com sucesso");

    const currentList = page.getByRole("list", { name: "Vínculos atuais" });
    const currentRow = currentList.getByRole("listitem").filter({ hasText: personName });
    await expect(currentRow).toContainText("Membro");
    await expect(currentRow).toContainText("Desde 10/01/2026");

    const membership = await prisma.ministryMembership.findFirstOrThrow({ where: { personId, ministryId } });
    const admin = await prisma.account.findUniqueOrThrow({ where: { username: "demo-admin" } });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: membership.id, action: "CREATE" } })).resolves.toMatchObject({
      actorId: admin.id,
      after: expect.objectContaining({ role: "MEMBER", startDate: membership.startDate.toISOString() }),
    });

    const roleRow = page.getByRole("list", { name: "Vínculos atuais" }).getByRole("listitem").filter({ hasText: personName });
    await roleRow.getByLabel("Data efetiva do cargo").fill("2026-03-15");
    await roleRow.getByRole("button", { name: "Tornar líder" }).click();
    await expect(roleRow.getByText("Líder")).toBeVisible();
    await expect(roleRow.getByText("Cargo atualizado com sucesso.")).toBeVisible();
    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ role: "LEADER" });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: membership.id, action: "UPDATE_ROLE" } })).resolves.toMatchObject({
      actorId: admin.id,
      before: expect.objectContaining({ role: "MEMBER" }),
      after: expect.objectContaining({ role: "LEADER", effectiveDate: "2026-03-15T00:00:00.000Z" }),
    });

    await roleRow.getByLabel("Data de saída").fill("2026-06-30");
    page.once("dialog", (dialog) => dialog.accept());
    await roleRow.getByRole("button", { name: "Encerrar vínculo" }).click();
    await expect(roleRow).toHaveCount(0);
    const historicRow = page.getByRole("list", { name: "Histórico de vínculos" }).getByRole("listitem").filter({ hasText: personName });
    await expect(historicRow).toContainText("Líder");
    await expect(historicRow).toContainText("De 10/01/2026 até 30/06/2026");
    await expect(page.getByText("Vínculo encerrado com sucesso.", { exact: true })).toBeVisible();
    await expect(historicRow.getByRole("button", { name: "Encerrar vínculo" })).toHaveCount(0);
    await expect(historicRow.getByRole("button", { name: "Tornar membro" })).toHaveCount(0);
    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({
      role: "LEADER",
      endDate: new Date("2026-06-30T00:00:00.000Z"),
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: membership.id, action: "END" } })).resolves.toMatchObject({
      actorId: admin.id,
      before: expect.objectContaining({ endDate: null }),
      after: expect.objectContaining({ endDate: "2026-06-30T00:00:00.000Z" }),
    });

    await page.goto(`/pessoas/${personId}/timeline`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Pessoa vinculada ao Ministério" })).toBeVisible();
    await expect(page.getByText(new RegExp(`${ministryName} · Cargo: Membro · Entrada:`))).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cargo no Ministério alterado" })).toBeVisible();
    await expect(page.getByText(new RegExp(`${ministryName} · Cargo: Membro → Líder · Efeito em 15/03/2026`))).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vínculo ministerial encerrado" })).toBeVisible();
    await expect(page.getByText(new RegExp(`${ministryName} · Saída: 30/06/2026`))).toBeVisible();
  });

  test("Secretary cannot open the administrative membership route directly", async ({ page }) => {
    await login(page, "demo-secretary");
    const response = await page.goto(`/ministerios/${ministryId}/vinculos`, { waitUntil: "domcontentloaded" });

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Gerenciar vínculos" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Vincular pessoa" })).toHaveCount(0);
  });

  test("Leader cannot open the administrative membership route directly", async ({ page }) => {
    await login(page, "demo-leader");
    const response = await page.goto(`/ministerios/${ministryId}/vinculos`, { waitUntil: "domcontentloaded" });

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Gerenciar vínculos" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Vincular pessoa" })).toHaveCount(0);
  });

  test("Admin cannot create a membership with a future entry date", async ({ page }) => {
    await login(page, "demo-admin");
    await page.goto(`/ministerios/${ministryId}/vinculos`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Pessoa").selectOption(invalidDatePersonId);
    await page.getByLabel("Cargo ministerial").selectOption("MEMBER");
    await page.getByLabel("Data de entrada").fill("2027-01-01");
    await page.getByRole("button", { name: "Vincular pessoa" }).click();

    await expect(page.locator('p[role="alert"]')).toContainText("Data de entrada não pode ser futura.");
    await expect(prisma.ministryMembership.count({ where: { personId: invalidDatePersonId, ministryId } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { personId: invalidDatePersonId, category: "MINISTRY" } })).resolves.toBe(0);
  });
});

function currentBrazilDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
