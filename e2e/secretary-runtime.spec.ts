import { expect, test, type Page, type Request } from "@playwright/test";
import { createMembership, endMembership, updateMembershipRole } from "../src/features/ministerios/membership-service";
import { createSession } from "../src/features/auth/session-service";
import { prisma } from "../src/lib/prisma";
import { createSessionCookie, hashSessionToken, SESSION_COOKIE_NAME } from "../src/lib/session";
import { DEMO_PASSWORD, DEMO_SCENARIO_IDS } from "./demo-fixtures";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const titlePrefix = `E2E secretária ${runId}`;
const expiredToken = `expired-secretary-e2e-${runId}`;
const expiredTokenHash = hashSessionToken(expiredToken);
const secretaryAccountId = "demo-account-secretary";

function watchPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  return errors;
}

async function loginAsSecretary(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Nome de usuário").fill("demo-secretary");
  await page.getByLabel("Senha").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function authenticateAccount(page: Page, accountId: string) {
  await page.context().clearCookies();
  const session = await createSession(accountId);
  const cookie = createSessionCookie(session.token, session.expiresAt);
  await page.context().addCookies([{
    name: cookie.name,
    value: cookie.value,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    expires: cookie.options.expires.getTime() / 1000,
  }]);
}

test.afterAll(async () => {
  await prisma.session.deleteMany({ where: { tokenHash: expiredTokenHash } });
  await prisma.activity.deleteMany({ where: { title: { startsWith: titlePrefix } } });
  await prisma.$disconnect();
});

test("SEC-RUN-01 — secretary reloads the meeting agenda without a client exception", async ({ page }) => {
  const pageErrors = watchPageErrors(page);
  await loginAsSecretary(page);

  await page.goto("/encontros", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Encontros" })).toBeVisible();
  await expect(page.getByText("Demo Encontro de Comunidade")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Encontros" })).toBeVisible();
  await expect(page.getByText("Demo Encontro de Comunidade")).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("SEC-RUN-01 — secretary reloads an authorized attendance board", async ({ page }) => {
  const pageErrors = watchPageErrors(page);
  await loginAsSecretary(page);

  await page.goto(`/encontros/${DEMO_SCENARIO_IDS.meetings.scheduled}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Demo Encontro de Comunidade" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo" })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Demo Encontro de Comunidade" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo" })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("SEC-RUN-01/04 — secretary corrects attendance after a rejected save and can navigate onward", async ({ page }) => {
  const pageErrors = watchPageErrors(page);
  const suffix = Date.now().toString();
  const account = await prisma.account.create({
    data: {
      username: `secretary-route-${suffix}`,
      email: `secretary-route-${suffix}@example.test`,
      passwordHash: "e2e-test-hash",
      role: "SECRETARY",
      person: { create: { fullName: `Secretária rota ${suffix}` } },
    },
  });
  const category = await prisma.category.create({ data: { name: `Categoria rota ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério rota ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa rota ${suffix}` } });
  await prisma.ministryMembership.create({ data: { personId: person.id, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") } });
  const meeting = await prisma.meeting.create({
    data: {
      categoryId: category.id,
      title: `Encontro Secretaria rota ${suffix}`,
      scheduledAt: new Date("2026-09-10T22:00:00.000Z"),
      status: "SCHEDULED",
      audiences: { create: { ministryId: ministry.id } },
    },
  });

  try {
    await authenticateAccount(page, account.id);
    await page.goto(`/encontros/${meeting.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    let row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await expect(row).toContainText("Não confirmado");

    await prisma.meeting.update({ where: { id: meeting.id }, data: { status: "CANCELLED" } });
    await row.click();
    await expect(page.getByRole("status")).toHaveText("Encontro cancelado não aceita lançamentos de presença.");
    await expect(row).toContainText("Não confirmado");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "NOT_CONFIRMED" });

    await page.goto("/ministerios", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Ministérios" })).toBeVisible();
    await expect(page.getByRole("heading", { name: ministry.name })).toBeVisible();

    await prisma.meeting.update({ where: { id: meeting.id }, data: { status: "SCHEDULED" } });
    await page.goto(`/encontros/${meeting.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await expect(row).toContainText("Não confirmado");
    await row.click();
    await expect(row).toContainText("Presente");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "PRESENT" });
    expect(pageErrors).toEqual([]);
  } finally {
    await prisma.session.deleteMany({ where: { accountId: account.id } });
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: [person.id, account.personId] } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: [person.id, account.personId] } } });
  }
});

test("SEC-RUN-03 — ministry read remains valid without management forms", async ({ page }) => {
  const pageErrors = watchPageErrors(page);
  await loginAsSecretary(page);

  await page.goto("/ministerios", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Ministérios" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo Acolhimento" })).toBeVisible();
  await expect(page.locator("main form")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /gerenciar vínculos/i })).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Ministérios" })).toBeVisible();
  await expect(page.locator("main form")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test("SEC-RUN-03 — direct Secretary membership-service calls are denied without writes", async () => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({
    data: {
      username: `secretary-membership-${suffix}`,
      email: `secretary-membership-${suffix}@example.test`,
      passwordHash: "e2e-test-hash",
      role: "SECRETARY",
      person: { create: { fullName: `Secretária vínculo ${suffix}` } },
    },
  });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério protegido ${suffix}` } });
  const member = await prisma.person.create({ data: { fullName: `Pessoa protegida ${suffix}` } });
  const baselineMembership = await prisma.ministryMembership.create({
    data: { personId: member.id, ministryId: ministry.id, role: "MEMBER", startDate: new Date("2026-01-10T00:00:00.000Z") },
  });
  const proposedPerson = await prisma.person.create({ data: { fullName: `Pessoa sem vínculo ${suffix}` } });

  try {
    const secretary = { id: account.id, role: "SECRETARY" as const };
    await expect(createMembership(secretary, {
      personId: proposedPerson.id,
      ministryId: ministry.id,
      role: "MEMBER",
      startDate: new Date("2026-02-10T00:00:00.000Z"),
    })).rejects.toThrow("Apenas administradores");
    await expect(updateMembershipRole(secretary, baselineMembership.id, {
      role: "LEADER",
      effectiveDate: new Date("2026-03-10T00:00:00.000Z"),
    })).rejects.toThrow("Apenas administradores");
    await expect(endMembership(secretary, baselineMembership.id, {
      endDate: new Date("2026-04-10T00:00:00.000Z"),
    })).rejects.toThrow("Apenas administradores");

    await expect(prisma.ministryMembership.count({ where: { personId: proposedPerson.id, ministryId: ministry.id } })).resolves.toBe(0);
    await expect(prisma.ministryMembership.findUnique({ where: { id: baselineMembership.id } })).resolves.toMatchObject({ role: "MEMBER", endDate: null });
    await expect(prisma.auditEvent.count({ where: { actorId: account.id, targetType: "MinistryMembership" } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { personId: { in: [member.id, proposedPerson.id] }, category: "MINISTRY" } })).resolves.toBe(0);
  } finally {
    await prisma.ministryMembership.deleteMany({ where: { ministryId: ministry.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: [member.id, proposedPerson.id, account.personId] } } });
  }
});

test("SEC-RUN-02 — secretary can recover from invalid input and persist activities and subtasks", async ({ page }) => {
  const pageErrors = watchPageErrors(page);
  const activityTitle = `${titlePrefix} atividade`;
  const subtaskTitle = `${titlePrefix} subtask`;

  await expect.poll(async () => prisma.activity.count()).toBe(0);
  await loginAsSecretary(page);
  await page.goto("/atividades", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { name: "Atividades" })).toBeVisible();
  await expect(page.getByText("Nenhuma atividade nesta visão.", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await expect(page.getByText("Nenhuma atividade nesta visão.", { exact: true })).toBeVisible();

  await page.getByLabel("Título da atividade").fill("   ");
  await page.getByRole("button", { name: "Criar atividade" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Título da atividade é obrigatório.");
  await expect.poll(async () => prisma.activity.count()).toBe(0);
  await expect(page.getByRole("heading", { name: "Nova atividade" })).toBeVisible();

  await page.getByLabel("Título da atividade").fill(activityTitle);
  await page.getByLabel("Área").selectOption("TOMORROW");
  await page.getByRole("button", { name: "Criar atividade" }).click();
  await expect(page.getByRole("status")).toHaveText("Atividade criada com sucesso.");
  await expect(page.getByRole("article").filter({ hasText: activityTitle })).toBeVisible();
  await expect.poll(async () => prisma.activity.count({ where: { title: activityTitle } })).toBe(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  const activity = page.getByRole("article").filter({ hasText: activityTitle });
  await expect(activity).toBeVisible();
  await expect(activity.getByRole("button", { name: `Excluir atividade ${activityTitle}` })).toBeEnabled();
  await activity.getByLabel(`Nova subtask para ${activityTitle}`).fill(subtaskTitle);

  const subtaskActionPosts: string[] = [];
  const trackSubtaskAction = (request: Request) => {
    const requestUrl = new URL(request.url());
    if (request.method() === "POST" && requestUrl.pathname === "/atividades") {
      subtaskActionPosts.push(requestUrl.pathname);
    }
  };
  page.on("request", trackSubtaskAction);
  await activity.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByRole("status")).toHaveText("Subtask criada.");
  await expect.poll(async () => prisma.activitySubtask.count({ where: { title: subtaskTitle } })).toBe(1);
  await page.waitForLoadState("networkidle");
  page.off("request", trackSubtaskAction);
  expect(subtaskActionPosts).toHaveLength(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  const persistedActivity = page.getByRole("article").filter({ hasText: activityTitle });
  const subtask = persistedActivity.locator("li.subtask-row");
  await expect.poll(async () => prisma.activitySubtask.count({ where: { title: subtaskTitle } })).toBe(1);
  await expect(subtask).toHaveCount(1);
  await expect(subtask).toBeVisible();
  await expect(subtask.getByRole("button", { name: `Excluir subtask ${subtaskTitle}` })).toBeEnabled();
  await subtask.getByRole("checkbox").check();
  await subtask.getByRole("button", { name: "Salvar" }).click();
  await expect.poll(async () => prisma.activitySubtask.findFirst({
    where: { title: subtaskTitle },
    select: { completed: true },
  })).toEqual({ completed: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await expect(page.getByLabel(`Concluída: ${subtaskTitle}`)).toHaveCount(1);
  await expect(page.getByLabel(`Concluída: ${subtaskTitle}`)).toBeChecked();

  expect(pageErrors).toEqual([]);
});

test("SEC-RUN-04 — an expired session redirects all protected routes safely", async ({ page }) => {
  const pageErrors = watchPageErrors(page);
  await prisma.session.create({
    data: {
      accountId: secretaryAccountId,
      tokenHash: expiredTokenHash,
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  for (const route of [
    "/encontros",
    `/encontros/${DEMO_SCENARIO_IDS.meetings.scheduled}`,
    "/ministerios",
    "/atividades",
  ]) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.context().clearCookies();
    await page.context().addCookies([{
      name: SESSION_COOKIE_NAME,
      value: expiredToken,
      url: new URL(page.url()).origin,
      expires: Math.floor(Date.now() / 1000) + 60,
      httpOnly: true,
      sameSite: "Lax",
    }]);

    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Bem-vindo de volta." })).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
});
