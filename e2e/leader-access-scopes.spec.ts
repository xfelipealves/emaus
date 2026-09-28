import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";

test.describe("Leader ministry access scopes", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now().toString();
  const adminUsername = `e2e-scope-admin-${suffix}`;
  const leaderUsername = `e2e-scope-leader-${suffix}`;
  let adminId: string;
  let leaderId: string;
  let leaderName: string;
  let ministryId: string;
  let ministryName: string;
  let otherMinistryId: string;
  let currentPersonId: string;
  let historicPersonId: string;
  let outsidePersonId: string;
  let meetingId: string;
  let outsideMeetingId: string;
  let categoryId: string;
  let leaderBrowserPage: Page | undefined;

  test.afterEach(async () => {
    await leaderBrowserPage?.close();
    leaderBrowserPage = undefined;
  });

  async function login(page: Page, username: string) {
    await gotoPage(page, "/login");
    await page.getByLabel("Nome de usuário").fill(username);
    await page.getByLabel("Senha").fill("admin");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  }

  async function gotoPage(page: Page, path: string) {
    return page.goto(path, { waitUntil: "domcontentloaded" });
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
          person: { create: { fullName: `E2E Líder escopo ${suffix}` } },
        },
      }),
    ]);
    adminId = admin.id;
    leaderId = leader.id;
    leaderName = `E2E Líder escopo ${suffix}`;

    const [ministry, otherMinistry] = await Promise.all([
      prisma.ministry.create({ data: { name: `E2E Ministério concedido ${suffix}` } }),
      prisma.ministry.create({ data: { name: `E2E Ministério fora do escopo ${suffix}` } }),
    ]);
    ministryId = ministry.id;
    ministryName = ministry.name;
    otherMinistryId = otherMinistry.id;

    const [currentPerson, historicPerson, outsidePerson] = await Promise.all([
      prisma.person.create({ data: { fullName: `E2E participante atual ${suffix}`, status: "MEMBER" } }),
      prisma.person.create({ data: { fullName: `E2E participante histórico ${suffix}`, status: "MEMBER" } }),
      prisma.person.create({ data: { fullName: `E2E pessoa fora do escopo ${suffix}`, status: "MEMBER" } }),
    ]);
    currentPersonId = currentPerson.id;
    historicPersonId = historicPerson.id;
    outsidePersonId = outsidePerson.id;
    await prisma.ministryMembership.createMany({
      data: [
        { ministryId, personId: currentPersonId, role: "MEMBER", startDate: new Date("2026-01-01T00:00:00.000Z") },
        { ministryId, personId: historicPersonId, role: "LEADER", startDate: new Date("2025-01-01T00:00:00.000Z"), endDate: new Date("2025-12-31T00:00:00.000Z") },
        { ministryId: otherMinistryId, personId: outsidePersonId, role: "MEMBER", startDate: new Date("2026-01-01T00:00:00.000Z") },
      ],
    });

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

test("Admin grants and revokes; Leader stays within the granted Ministry and meeting", async ({ page, browser }) => {
    test.setTimeout(180_000);
    const leaderPage = await browser.newPage();
    leaderBrowserPage = leaderPage;
    const visitorName = `E2E visitante contextual ${suffix}`;
    const outsideVisitorName = `E2E visitante fora da frequência ${suffix}`;

    await login(leaderPage, leaderUsername);
    await gotoPage(leaderPage, "/ministerios");
    await expect(leaderPage.getByText("Você não tem acesso atual a nenhum Ministério.", { exact: true })).toBeVisible();
    await gotoPage(leaderPage, `/encontros/${meetingId}`);
    await expect(leaderPage).toHaveURL(/\/encontros$/);

    await login(page, adminUsername);
    await gotoPage(page, "/configuracoes/usuarios");
    await expect(page.getByRole("heading", { name: "Usuários e acessos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Escopos ministeriais" })).toBeVisible();
    await page.locator("#scope-leader").selectOption(leaderId);
    await page.locator("#scope-ministry").selectOption(ministryId);
    await page.getByRole("button", { name: "Conceder acesso" }).click();
    await expect(page.getByRole("status")).toContainText("Acesso concedido");
    await expect(page.getByRole("heading", { name: leaderName })).toBeVisible();
    const leaderScopeCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: leaderName }) });
    await expect(leaderScopeCard.getByText(ministryName, { exact: true })).toBeVisible();

    await gotoPage(leaderPage, "/ministerios");
    await expect(leaderPage.getByRole("link", { name: ministryName })).toBeVisible();
    await expect(leaderPage.getByRole("link", { name: `E2E Ministério fora do escopo ${suffix}` })).toHaveCount(0);
    const outsideMinistryResponse = await gotoPage(leaderPage, `/ministerios/${otherMinistryId}`);
    expect(outsideMinistryResponse?.status()).toBe(404);
    await gotoPage(leaderPage, `/encontros/${outsideMeetingId}`);
    await expect(leaderPage).toHaveURL(/\/encontros$/);
    const profileResponse = await gotoPage(leaderPage, `/ministerios/${ministryId}`);
    expect(profileResponse?.status()).toBe(200);
    await expect(leaderPage.getByRole("heading", { name: "Participantes atuais" })).toBeVisible();
    await expect(leaderPage.getByText(`E2E participante atual ${suffix}`)).toBeVisible();
    await expect(leaderPage.getByRole("heading", { name: "Histórico de participantes" })).toBeVisible();
    await expect(leaderPage.getByText(`E2E participante histórico ${suffix}`)).toBeVisible();

    const allowedPersonResponse = await gotoPage(leaderPage, `/pessoas/${currentPersonId}`);
    expect(allowedPersonResponse?.status()).toBe(200);
    const outsidePersonResponse = await gotoPage(leaderPage, `/pessoas/${outsidePersonId}`);
    expect(outsidePersonResponse?.status()).toBe(404);

    await leaderPage.goto(`/encontros/${meetingId}`);
    await expect(leaderPage.getByRole("heading", { name: `E2E encontro escopo ${suffix}` })).toBeVisible();
    await leaderPage.waitForLoadState("networkidle");
    await leaderPage.getByLabel("Nome do visitante rápido").fill(visitorName);
    const visitorActionResponse = leaderPage.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes(`/encontros/${meetingId}`),
      { timeout: 15_000 },
    );
    await leaderPage.getByRole("button", { name: "Adicionar visitante" }).click();
    await visitorActionResponse;
    await expect(leaderPage.getByRole("status")).toHaveText("Visitante adicionado.", { timeout: 15_000 });
    await expect(leaderPage.getByRole("button", { name: `Marcar ${visitorName}` })).toContainText("Não confirmado", { timeout: 15_000 });

    const visitor = await prisma.person.findFirstOrThrow({ where: { fullName: visitorName } });
    await expect(prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId, personId: visitor.id } } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });
    await expect(prisma.timelineEvent.findFirst({ where: { personId: visitor.id } })).resolves.toMatchObject({ category: "REGISTRATION", title: "Pessoa cadastrada" });
    await expect(prisma.auditEvent.findFirst({ where: { actorId: leaderId, targetId: visitor.id, action: "CREATE" } })).resolves.toMatchObject({ targetType: "Person" });
    await leaderPage.reload();
    await expect(leaderPage.getByRole("button", { name: `Marcar ${visitorName}` })).toContainText("Não confirmado", { timeout: 15_000 });
    await expect(prisma.attendance.count({ where: { meetingId, personId: visitor.id } })).resolves.toBe(1);

    await gotoPage(leaderPage, "/pessoas/nova");
    await leaderPage.getByLabel("Nome completo").fill(outsideVisitorName);
    await leaderPage.getByRole("button", { name: "Cadastrar Pessoa" }).click();
    await expect(leaderPage.locator("p[role='alert']")).toContainText("não tem permissão para cadastrar Pessoas");
    await expect(prisma.person.findFirst({ where: { fullName: outsideVisitorName } })).resolves.toBeNull();

    await page.reload({ waitUntil: "domcontentloaded" });
    const revokeButton = page.getByRole("button", { name: new RegExp(`Revogar.*${ministryName}`) });
    await revokeButton.click();
    await expect(page.getByRole("button", { name: new RegExp(`Revogar.*${ministryName}`) })).toHaveCount(0);
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

    await gotoPage(leaderPage, "/ministerios");
    await expect(leaderPage.getByText("Você não tem acesso atual a nenhum Ministério.", { exact: true })).toBeVisible();
    const revokedProfileResponse = await gotoPage(leaderPage, `/ministerios/${ministryId}`);
    expect(revokedProfileResponse?.status()).toBe(404);
    await gotoPage(leaderPage, `/encontros/${meetingId}`);
    await expect(leaderPage).toHaveURL(/\/encontros$/);
    await expect(prisma.person.findFirst({ where: { fullName: `E2E visitante após revoke ${suffix}` } })).resolves.toBeNull();

    await gotoPage(leaderPage, "/configuracoes/usuarios");
    await expect(leaderPage).toHaveURL(/\/$/);
    await expect(leaderPage.getByRole("heading", { name: "Escopos ministeriais" })).toHaveCount(0);
  });

  test.afterAll(async () => {
    const people = await prisma.person.findMany({ where: { fullName: { contains: suffix } }, select: { id: true } });
    const personIds = people.map((person) => person.id);
    const access = await prisma.accountMinistryAccess.findUnique({ where: { accountId_ministryId: { accountId: leaderId, ministryId } } });
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ actorId: { in: [adminId, leaderId] } }, ...(access ? [{ targetId: access.id }] : []), { targetId: { in: personIds } }] },
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
