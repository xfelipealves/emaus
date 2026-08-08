import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";
import { createSession } from "../src/features/auth/session-service";
import { createSessionCookie } from "../src/lib/session";

test.describe("ministry administration", () => {
  const username = "t21-ministry-admin";

  test.beforeAll(async () => {
    const previousMinistries = await prisma.ministry.findMany({ where: { name: { startsWith: "Ministério E2E T21" } }, select: { id: true } });
    const previousMinistryIds = previousMinistries.map((ministry) => ministry.id);
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: previousMinistryIds } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: previousMinistryIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: previousMinistryIds } } });
    await prisma.account.deleteMany({ where: { username } });
    const account = await prisma.account.create({
      data: {
        username,
        email: `${username}@example.test`,
        passwordHash: await hashPassword("senha-t21-valida"),
        role: "ADMINISTRATOR",
        person: { create: { fullName: "Administrador T21 E2E" } },
      },
    });
    expect(account.status).toBe("ACTIVE");
  });

  test.afterAll(async () => {
    const ministries = await prisma.ministry.findMany({ where: { name: { startsWith: "Ministério E2E T21" } }, select: { id: true } });
    const ministryIds = ministries.map((ministry) => ministry.id);
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: ministryIds } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: ministryIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: ministryIds } } });
    const account = await prisma.account.findUnique({ where: { username } });
    if (account) {
      await prisma.account.delete({ where: { id: account.id } });
      await prisma.person.delete({ where: { id: account.personId } });
    }
    await prisma.$disconnect();
  });

  test("creates, edits and archives a ministry", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill("senha-t21-valida");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/ministerios");

    const createForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Criar Ministério" }) });
    await createForm.getByLabel("Nome", { exact: true }).fill("Ministério E2E T21");
    await createForm.getByLabel(/Descrição/).fill("Descrição E2E");
    await page.getByRole("button", { name: "Criar Ministério" }).click();
    await expect(page.getByRole("heading", { name: "Ministério E2E T21" })).toBeVisible();

    const ministryCard = page.getByRole("article").filter({ hasText: "Ministério E2E T21" });
    await ministryCard.getByLabel("Nome", { exact: true }).fill("Ministério E2E T21 atualizado");
    await ministryCard.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("heading", { name: "Ministério E2E T21 atualizado" })).toBeVisible();

    const updatedMinistryCard = page.getByRole("heading", { name: "Ministério E2E T21 atualizado" }).locator("xpath=ancestor::article");
    page.on("dialog", (dialog) => dialog.accept());
    await updatedMinistryCard.getByRole("button", { name: "Arquivar Ministério" }).click();
    await expect(updatedMinistryCard.getByText("Arquivado")).toBeVisible();
    await expect(updatedMinistryCard.getByRole("button", { name: "Arquivar Ministério" })).toHaveCount(0);
  });

  test("shows current and historic participants and restricts leaders to granted ministries", async ({ page }) => {
    const suffix = Date.now().toString();
    const ministry = await prisma.ministry.create({ data: { name: `Ministério E2E T24 ${suffix}`, description: "Perfil T24" } });
    const otherMinistry = await prisma.ministry.create({ data: { name: `Ministério E2E T24 outro ${suffix}` } });
    const current = await prisma.person.create({ data: { fullName: `Pessoa atual T24 ${suffix}`, status: "MEMBER" } });
    const historic = await prisma.person.create({ data: { fullName: `Pessoa histórica T24 ${suffix}`, status: "MEMBER" } });
    await prisma.ministryMembership.createMany({ data: [
      { ministryId: ministry.id, personId: current.id, role: "MEMBER", startDate: new Date("2026-01-01") },
      { ministryId: ministry.id, personId: historic.id, role: "LEADER", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
    ] });
    const leaderUsername = "t24-profile-leader";
    await prisma.account.deleteMany({ where: { username: leaderUsername } });
    const leader = await prisma.account.create({
      data: { username: leaderUsername, email: `${leaderUsername}@example.test`, passwordHash: await hashPassword("senha-t24-valida"), role: "LEADER", person: { create: { fullName: `Líder T24 ${suffix}` } }, ministryAccess: { create: { ministryId: ministry.id } } },
    });

    try {
      const session = await createSession(leader.id);
      const cookie = createSessionCookie(session.token, session.expiresAt);
      await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
      await page.goto(`/ministerios/${ministry.id}`);
      await expect(page.getByRole("heading", { name: ministry.name })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Participantes atuais" })).toBeVisible();
      await expect(page.getByText(current.fullName)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Histórico de participantes" })).toBeVisible();
      await expect(page.getByText(historic.fullName)).toBeVisible();
      await page.goto(`/ministerios/${otherMinistry.id}`);
      await expect(page.getByRole("heading", { name: otherMinistry.name })).toHaveCount(0);
    } finally {
      await prisma.accountMinistryAccess.deleteMany({ where: { accountId: leader.id } });
      await prisma.account.delete({ where: { id: leader.id } });
      await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: [ministry.id, otherMinistry.id] } } });
      await prisma.person.deleteMany({ where: { id: { in: [current.id, historic.id, leader.personId] } } });
      await prisma.ministry.deleteMany({ where: { id: { in: [ministry.id, otherMinistry.id] } } });
    }
  });
});
