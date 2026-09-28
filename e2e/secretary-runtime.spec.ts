import { expect, test, type Page, type Request } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { hashSessionToken, SESSION_COOKIE_NAME } from "../src/lib/session";
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
