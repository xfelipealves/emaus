import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("Leader ministry access scopes", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now().toString();
  const adminUsername = `e2e-scope-admin-${suffix}`;
  const leaderUsername = `e2e-scope-leader-${suffix}`;
  const leaderName = `E2E Líder escopo ${suffix}`;
  const ministryName = `E2E Ministério concedido ${suffix}`;
  const otherMinistryName = `E2E Ministério fora do escopo ${suffix}`;
  let adminId: string;
  let leaderId: string;
  let ministryId: string;
  let otherMinistryId: string;
  let categoryId: string;
  let meetingId: string;
  let outsideMeetingId: string;
  let leaderPage: Page | undefined;

  async function gotoPage(page: Page, path: string) {
    return page.goto(path, { waitUntil: "domcontentloaded" });
  }

  async function login(page: Page, username: string) {
    await gotoPage(page, "/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill("admin");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  }

  test.beforeAll(async () => {
    const [admin, leader] = await Promise.all([
      prisma.account.create({
        data: {
          username: adminUsername,
          email: `${adminUsername}@example.test`,
          passwordHash: await hashPassword("admin"),
          role: "ADMINISTRATOR",
          person: { create: { fullName: `E2E Admin escopo ${suffix}` } },
        },
      }),
      prisma.account.create({
        data: {
          username: leaderUsername,
          email: `${leaderUsername}@example.test`,
          passwordHash: await hashPassword("admin"),
          role: "LEADER",
          person: { create: { fullName: leaderName } },
        },
      }),
    ]);
    adminId = admin.id;
    leaderId = leader.id;

    const [ministry, otherMinistry] = await Promise.all([
      prisma.ministry.create({ data: { name: ministryName } }),
      prisma.ministry.create({ data: { name: otherMinistryName } }),
    ]);
    ministryId = ministry.id;
    otherMinistryId = otherMinistry.id;

    const category = await prisma.category.create({ data: { name: `E2E categoria escopo ${suffix}` } });
    categoryId = category.id;
    const [meeting, outsideMeeting] = await Promise.all([
      prisma.meeting.create({
        data: {
          categoryId,
          title: `E2E encontro escopo ${suffix}`,
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          status: "SCHEDULED",
          audiences: { create: { ministryId } },
        },
      }),
      prisma.meeting.create({
        data: {
          categoryId,
          title: `E2E encontro fora do escopo ${suffix}`,
          scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
          status: "SCHEDULED",
          audiences: { create: { ministryId: otherMinistryId } },
        },
      }),
    ]);
    meetingId = meeting.id;
    outsideMeetingId = outsideMeeting.id;
  });

  test.afterEach(async () => {
    await leaderPage?.close();
    leaderPage = undefined;
  });

  test("Admin grants and revokes; Leader stays in scope and registers visitors contextually", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const secondaryPage = await browser.newPage();
    leaderPage = secondaryPage;
    const visitorName = `E2E visitante contextual ${suffix}`;
    const outsideVisitorName = `E2E visitante fora da frequência ${suffix}`;

    await login(secondaryPage, leaderUsername);
    await gotoPage(secondaryPage, "/ministerios");
    await expect(secondaryPage.getByText("Você não tem acesso atual a nenhum Ministério.", { exact: true })).toBeVisible();
    await gotoPage(secondaryPage, `/encontros/${meetingId}`);
    await expect(secondaryPage).toHaveURL(/\/encontros$/);

    await login(page, adminUsername);
    await gotoPage(page, "/configuracoes/usuarios");
    await expect(page.getByRole("heading", { name: "Escopos ministeriais" })).toBeVisible();
    await page.locator("#scope-leader").selectOption(leaderId);
    await page.locator("#scope-ministry").selectOption(ministryId);
    await page.getByRole("button", { name: "Conceder acesso" }).click();
    await expect(page.getByRole("status")).toContainText("Acesso concedido");
    await expect(page.getByRole("heading", { name: leaderName })).toBeVisible();

    await gotoPage(secondaryPage, "/ministerios");
    await expect(secondaryPage.getByRole("link", { name: ministryName })).toBeVisible();
    await expect(secondaryPage.getByRole("link", { name: otherMinistryName })).toHaveCount(0);
    const outsideMinistryResponse = await gotoPage(secondaryPage, `/ministerios/${otherMinistryId}`);
    expect(outsideMinistryResponse?.status()).toBe(404);
    await gotoPage(secondaryPage, `/encontros/${outsideMeetingId}`);
    await expect(secondaryPage).toHaveURL(/\/encontros$/);

    await gotoPage(secondaryPage, `/encontros/${meetingId}`);
    await expect(secondaryPage.getByRole("heading", { name: `E2E encontro escopo ${suffix}` })).toBeVisible();
    await secondaryPage.waitForLoadState("networkidle");
    await secondaryPage.getByLabel("Nome do visitante rápido").fill(visitorName);
    await secondaryPage.getByRole("button", { name: "Adicionar visitante" }).click();
    await expect(secondaryPage.getByRole("status")).toHaveText("Visitante adicionado.", { timeout: 30_000 });
    await expect(secondaryPage.getByRole("button", { name: `Marcar ${visitorName}` })).toContainText("Não confirmado", { timeout: 15_000 });

    const visitor = await prisma.person.findFirstOrThrow({ where: { fullName: visitorName } });
    await expect(prisma.person.findUnique({ where: { id: visitor.id } })).resolves.toMatchObject({ status: "VISITOR" });
    await expect(prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId, personId: visitor.id } } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });
    await expect(prisma.timelineEvent.findFirst({ where: { personId: visitor.id } })).resolves.toMatchObject({ category: "REGISTRATION", title: "Pessoa cadastrada" });
    await expect(prisma.auditEvent.findFirst({ where: { actorId: leaderId, targetId: visitor.id, action: "CREATE" } })).resolves.toMatchObject({ targetType: "Person" });
    await secondaryPage.reload();
    await expect(secondaryPage.getByRole("button", { name: `Marcar ${visitorName}` })).toContainText("Não confirmado", { timeout: 15_000 });
    await expect(prisma.attendance.count({ where: { meetingId, personId: visitor.id } })).resolves.toBe(1);

    await gotoPage(secondaryPage, "/pessoas/nova");
    await secondaryPage.getByLabel("Nome completo").fill(outsideVisitorName);
    await secondaryPage.getByRole("button", { name: "Cadastrar Pessoa" }).click();
    await expect(secondaryPage.locator("p[role='alert']")).toContainText("não tem permissão para gerenciar Pessoas");
    await expect(prisma.person.findFirst({ where: { fullName: outsideVisitorName } })).resolves.toBeNull();

    await page.reload({ waitUntil: "domcontentloaded" });
    const revokeButton = page.getByRole("button", { name: `Revogar acesso de ${leaderName} ao Ministério ${ministryName}` });
    await revokeButton.click();
    await expect(page.getByRole("button", { name: `Revogar acesso de ${leaderName} ao Ministério ${ministryName}` })).toHaveCount(0);
    const access = await prisma.accountMinistryAccess.findUniqueOrThrow({ where: { accountId_ministryId: { accountId: leaderId, ministryId } } });
    expect(access.revokedAt).toBeInstanceOf(Date);
    await expect(prisma.auditEvent.findFirst({ where: { targetId: access.id, action: "GRANT" } })).resolves.toMatchObject({
      actorId: adminId,
      targetType: "AccountMinistryAccess",
      after: expect.objectContaining({ accountId: leaderId, ministryId, revokedAt: null }),
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: access.id, action: "REVOKE" } })).resolves.toMatchObject({
      actorId: adminId,
      targetType: "AccountMinistryAccess",
      before: expect.objectContaining({ revokedAt: null }),
      after: expect.objectContaining({ revokedAt: access.revokedAt?.toISOString() }),
    });

    await gotoPage(secondaryPage, "/ministerios");
    await expect(secondaryPage.getByText("Você não tem acesso atual a nenhum Ministério.", { exact: true })).toBeVisible();
    const revokedProfileResponse = await gotoPage(secondaryPage, `/ministerios/${ministryId}`);
    expect(revokedProfileResponse?.status()).toBe(404);
    await gotoPage(secondaryPage, `/encontros/${meetingId}`);
    await expect(secondaryPage).toHaveURL(/\/encontros$/);
  });

  test.afterAll(async () => {
    const people = await prisma.person.findMany({ where: { fullName: { contains: suffix } }, select: { id: true } });
    const personIds = people.map((person) => person.id);
    const access = await prisma.accountMinistryAccess.findUnique({ where: { accountId_ministryId: { accountId: leaderId, ministryId } } });
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { actorId: { in: [adminId, leaderId] } },
          { targetId: { in: [...personIds, ...(access ? [access.id] : [])] } },
        ],
      },
    });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.attendance.deleteMany({ where: { meetingId: { in: [meetingId, outsideMeetingId] } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: { in: [meetingId, outsideMeetingId] } } });
    await prisma.meeting.deleteMany({ where: { id: { in: [meetingId, outsideMeetingId] } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: [ministryId, otherMinistryId] } } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: leaderId } });
    await prisma.account.deleteMany({ where: { id: { in: [adminId, leaderId] } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: [ministryId, otherMinistryId] } } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });
});
