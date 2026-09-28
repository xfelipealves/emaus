import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("ministry membership management", () => {
  test.describe.configure({ mode: "serial" });
  const suffix = Date.now().toString();
  const adminUsername = `t3-memberships-admin-${suffix}`;
  const leaderUsername = `t3-memberships-leader-${suffix}`;
  const adminName = `Admin Vínculos T3 ${suffix}`;
  const personName = `Pessoa Vínculos T3 ${suffix}`;
  const ministryName = `Ministério Vínculos T3 ${suffix}`;
  const startDate = "2024-04-03";
  const roleDate = "2025-02-10";
  const endDate = "2026-06-30";
  let personId: string;
  let ministryId: string;
  let leaderAccountId: string;
  let membershipId: string | undefined;

  test.beforeAll(async () => {
    const administrator = await prisma.account.create({
      data: {
        username: adminUsername,
        email: `${adminUsername}@example.test`,
        passwordHash: await hashPassword("senha-t3-admin"),
        role: "ADMINISTRATOR",
        person: { create: { fullName: adminName } },
      },
    });
    const person = await prisma.person.create({ data: { fullName: personName } });
    personId = person.id;
    const leader = await prisma.account.create({
      data: {
        username: leaderUsername,
        email: `${leaderUsername}@example.test`,
        passwordHash: await hashPassword("senha-t3-leader"),
        role: "LEADER",
        person: { create: { fullName: `Líder Vínculos T3 ${suffix}` } },
      },
    });
    leaderAccountId = leader.id;
    const ministry = await prisma.ministry.create({ data: { name: ministryName } });
    ministryId = ministry.id;
    await prisma.accountMinistryAccess.create({ data: { accountId: leaderAccountId, ministryId } });
    expect(administrator.role).toBe("ADMINISTRATOR");
  });

  test.afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { targetId: membershipId } });
    await prisma.timelineEvent.deleteMany({ where: { personId } });
    await prisma.ministryMembership.deleteMany({ where: { personId } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: leaderAccountId } });
    await prisma.account.deleteMany({ where: { username: { in: [adminUsername, leaderUsername] } } });
    await prisma.ministry.deleteMany({ where: { id: ministryId } });
    await prisma.person.deleteMany({ where: { fullName: { in: [adminName, personName, `Líder Vínculos T3 ${suffix}`] } } });
    await prisma.$disconnect();
  });

  async function login(page: Page) {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(adminUsername);
    await page.getByLabel("Senha").fill("senha-t3-admin");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  }

  test("creates, changes, closes, and reloads a membership with a complete timeline", async ({ page }) => {
    await login(page);
    await page.goto(`/ministerios/${ministryId}`);
    await page.getByRole("link", { name: "Gerenciar vínculos" }).click();

    await page.getByLabel("Pessoa").selectOption(personId);
    await page.getByLabel("Cargo").selectOption("MEMBER");
    await page.getByLabel("Data de entrada").fill(startDate);
    await page.getByRole("button", { name: "Criar vínculo" }).click();
    await expect(page.getByRole("region", { name: "Vínculos atuais" })).toContainText(personName);
    await expect(page.getByRole("region", { name: "Vínculos atuais" })).toContainText("Desde 03/04/2024");

    await page.getByLabel("Novo cargo").selectOption("LEADER");
    await page.getByLabel("Data efetiva do cargo").fill(roleDate);
    await page.getByRole("button", { name: "Salvar cargo" }).click();
    await expect(page.getByRole("region", { name: "Vínculos atuais" })).toContainText("Líder");

    await page.getByLabel("Data de saída").fill(endDate);
    await page.getByRole("button", { name: "Encerrar vínculo" }).click();
    await expect(page.getByRole("region", { name: "Histórico de vínculos" })).toContainText(personName);
    await expect(page.getByRole("region", { name: "Histórico de vínculos" })).toContainText("Entrada: 03/04/2024");
    await expect(page.getByRole("region", { name: "Histórico de vínculos" })).toContainText("Saída: 30/06/2026");

    const membership = await prisma.ministryMembership.findFirstOrThrow({ where: { personId, ministryId } });
    membershipId = membership.id;
    expect(membership.role).toBe("LEADER");
    expect(membership.startDate).toEqual(new Date(`${startDate}T00:00:00.000Z`));
    expect(membership.endDate).toEqual(new Date(`${endDate}T00:00:00.000Z`));
    await expect(prisma.accountMinistryAccess.count({ where: { accountId: leaderAccountId, ministryId, revokedAt: null } })).resolves.toBe(1);

    await page.reload();
    await expect(page.getByRole("region", { name: "Vínculos atuais" })).toContainText("Nenhum vínculo atual");
    await expect(page.getByRole("region", { name: "Histórico de vínculos" })).toContainText("Entrada: 03/04/2024");
    await expect(page.getByRole("region", { name: "Histórico de vínculos" })).toContainText("Saída: 30/06/2026");
    await expect(page.getByRole("region", { name: "Histórico de vínculos" })).toContainText("Líder");

    await page.goto(`/pessoas/${personId}`, { waitUntil: "domcontentloaded" });
    const personMinistries = page.getByRole("heading", { name: "Ministérios", exact: true }).locator("..");
    await expect(personMinistries).toContainText("Entrada: 03/04/2024");
    await expect(personMinistries).toContainText("Saída: 30/06/2026");

    await page.goto(`/pessoas/${personId}/timeline?filter=ministries`);
    await expect(page.getByRole("heading", { name: `Timeline de ${personName}` })).toBeVisible();
    const timeline = page.getByRole("region", { name: "Eventos da timeline" });
    await expect(timeline).toContainText("Pessoa vinculada ao Ministério");
    await expect(timeline).toContainText("Cargo no Ministério alterado");
    await expect(timeline).toContainText("Vínculo ministerial encerrado");
    await expect(timeline).toContainText(personName);
    await expect(timeline).toContainText(ministryName);
    await expect(timeline).toContainText(adminName);
    await expect(timeline).toContainText("Membro → Líder");
    await expect(timeline).toContainText("Efeito em 10/02/2025");
  });
});
