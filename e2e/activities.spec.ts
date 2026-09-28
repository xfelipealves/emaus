import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { DEMO_PASSWORD } from "./demo-fixtures";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const titlePrefix = `E2E atividades ${runId}`;

async function login(page: Page, username = "demo-admin") {
  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill(username);
  await page.getByLabel("Senha").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

test.afterAll(async () => {
  await prisma.activity.deleteMany({ where: { title: { startsWith: titlePrefix } } });
  await prisma.$disconnect();
});

test("creates, filters, edits and deletes activities with subtasks", async ({ page }) => {
  const tomorrowTitle = `${titlePrefix} amanhã`;
  const backlogTitle = `${titlePrefix} backlog`;
  const parkedTitle = `${titlePrefix} estacionada`;
  const firstSubtaskTitle = `${titlePrefix} subtask`;
  const updatedSubtaskTitle = `${titlePrefix} subtask atualizada`;
  const cascadeSubtaskTitle = `${titlePrefix} subtask em cascata`;

  await login(page);
  await page.goto("/atividades");
  await expect(page.getByRole("heading", { name: "Atividades", exact: true })).toBeVisible();

  const titleInput = page.getByLabel("Título da atividade");
  const bucketInput = page.getByLabel("Área");

  for (const [title, bucket] of [
    [tomorrowTitle, "TOMORROW"],
    [backlogTitle, "BACKLOG"],
    [parkedTitle, "PARKED"],
  ] as const) {
    await titleInput.fill(title);
    await bucketInput.selectOption(bucket);
    await page.getByRole("button", { name: "Criar atividade" }).click();
    await expect(page.getByRole("article").filter({ hasText: title })).toBeVisible();
  }

  await page.locator("#activity-filter").selectOption("tomorrow");
  await page.getByRole("button", { name: "Ver" }).click();
  await expect(page).toHaveURL(/bucket=tomorrow/);
  await expect(page.getByRole("article").filter({ hasText: tomorrowTitle })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: backlogTitle })).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: parkedTitle })).toHaveCount(0);

  await page.locator("#activity-filter").selectOption("backlog");
  await page.getByRole("button", { name: "Ver" }).click();
  await expect(page).toHaveURL(/bucket=backlog/);
  await expect(page.getByRole("article").filter({ hasText: backlogTitle })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: tomorrowTitle })).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: parkedTitle })).toHaveCount(0);

  await page.locator("#activity-filter").selectOption("parked");
  await page.getByRole("button", { name: "Ver" }).click();
  await expect(page).toHaveURL(/bucket=parked/);
  await expect(page.getByRole("article").filter({ hasText: parkedTitle })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: tomorrowTitle })).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: backlogTitle })).toHaveCount(0);

  await page.locator("#activity-filter").selectOption("all");
  await page.getByRole("button", { name: "Ver" }).click();
  const activity = page.getByRole("article").filter({ hasText: tomorrowTitle });
  await expect(page).toHaveURL(/\/atividades(?:\?|$)/);
  await expect(activity).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: backlogTitle })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: parkedTitle })).toBeVisible();

  await activity.getByLabel(`Nova subtask para ${tomorrowTitle}`).fill(firstSubtaskTitle);
  await activity.getByRole("button", { name: "Adicionar" }).click();
  const firstSubtask = activity.getByRole("listitem").filter({ hasText: firstSubtaskTitle });
  await expect(firstSubtask).toBeVisible();
  await firstSubtask.getByRole("textbox").fill(updatedSubtaskTitle);
  await firstSubtask.getByRole("checkbox").check();
  await firstSubtask.getByRole("button", { name: "Salvar" }).click();
  await expect.poll(async () => prisma.activitySubtask.findFirst({
    where: { title: updatedSubtaskTitle },
    select: { completed: true },
  })).toEqual({ completed: true });

  await page.once("dialog", (dialog) => dialog.accept());
  await firstSubtask.getByRole("button", { name: `Excluir subtask ${updatedSubtaskTitle}` }).click();
  await expect(activity.getByRole("listitem").filter({ hasText: updatedSubtaskTitle })).toHaveCount(0);
  await expect.poll(async () => prisma.activitySubtask.count({ where: { title: updatedSubtaskTitle } })).toBe(0);

  await activity.getByLabel(`Nova subtask para ${tomorrowTitle}`).fill(cascadeSubtaskTitle);
  await activity.getByRole("button", { name: "Adicionar" }).click();
  const cascadeSubtask = activity.getByRole("listitem").filter({ hasText: cascadeSubtaskTitle });
  await expect(cascadeSubtask).toBeVisible();

  const deleteActivityButton = activity.getByRole("button", { name: `Excluir atividade ${tomorrowTitle}` });
  let activityDeleteConfirmation: string | undefined;
  page.once("dialog", async (dialog) => {
    activityDeleteConfirmation = dialog.message();
    await dialog.dismiss();
  });
  await deleteActivityButton.click();
  expect(activityDeleteConfirmation).toBe(`Excluir a atividade ${tomorrowTitle}? As subtasks também serão excluídas.`);
  await expect(activity).toBeVisible();
  await expect(cascadeSubtask).toBeVisible();
  await expect.poll(async () => prisma.activity.findFirst({
    where: { title: tomorrowTitle },
    select: { bucket: true, subtasks: { select: { title: true } } },
  })).toEqual({ bucket: "TOMORROW", subtasks: [{ title: cascadeSubtaskTitle }] });

  await page.reload();
  const activityAfterCancel = page.getByRole("article").filter({ hasText: tomorrowTitle });
  await expect(activityAfterCancel).toBeVisible();
  await expect(activityAfterCancel.getByRole("listitem").filter({ hasText: cascadeSubtaskTitle })).toBeVisible();

  page.once("dialog", async (dialog) => { await dialog.accept(); });
  await activityAfterCancel.getByRole("button", { name: `Excluir atividade ${tomorrowTitle}` }).click();
  await expect(activityAfterCancel).toHaveCount(0);
  await expect.poll(async () => prisma.activity.count({ where: { title: tomorrowTitle } })).toBe(0);
  await expect.poll(async () => prisma.activitySubtask.count({ where: { title: cascadeSubtaskTitle } })).toBe(0);
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: tomorrowTitle })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nova atividade" })).toBeVisible();
});

test("activity deletion stays unavailable until its confirmation handler is ready", async ({ page, browser }) => {
  const protectedTitle = `${titlePrefix} proteção de exclusão`;
  const protectedSubtaskTitle = `${titlePrefix} subtask protegida`;

  await login(page);
  await page.goto("/atividades");
  await page.getByLabel("Título da atividade").fill(protectedTitle);
  await page.getByLabel("Área").selectOption("BACKLOG");
  await page.getByRole("button", { name: "Criar atividade" }).click();
  const activity = page.getByRole("article").filter({ hasText: protectedTitle });
  await expect(activity).toBeVisible();
  await activity.getByLabel(`Nova subtask para ${protectedTitle}`).fill(protectedSubtaskTitle);
  await activity.getByRole("button", { name: "Adicionar" }).click();
  await expect(activity.getByRole("listitem").filter({ hasText: protectedSubtaskTitle })).toBeVisible();

  const noJavaScriptContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    javaScriptEnabled: false,
  });
  try {
    const noJavaScriptPage = await noJavaScriptContext.newPage();
    await login(noJavaScriptPage, "demo-admin");
    await noJavaScriptPage.goto("/atividades");
    const noJavaScriptActivity = noJavaScriptPage.getByRole("article").filter({ hasText: protectedTitle });
    await expect(noJavaScriptActivity).toBeVisible();
    await expect(noJavaScriptActivity.getByRole("button", { name: `Excluir atividade ${protectedTitle}` })).toBeDisabled();
    await expect(noJavaScriptActivity.getByRole("button", { name: `Excluir subtask ${protectedSubtaskTitle}` })).toBeDisabled();
    await expect.poll(async () => prisma.activity.findFirst({
      where: { title: protectedTitle },
      select: { subtasks: { select: { title: true } } },
    })).toEqual({ subtasks: [{ title: protectedSubtaskTitle }] });
  } finally {
    await noJavaScriptContext.close();
  }
});

test("secretary and leader complete a shared activity journey", async ({ page }) => {
  const sharedTitle = `${titlePrefix} jornada compartilhada`;
  const sharedSubtaskTitle = `${titlePrefix} subtask compartilhada`;

  await login(page, "demo-admin");
  await page.goto("/atividades");
  await page.getByLabel("Título da atividade").fill(sharedTitle);
  await page.getByLabel("Área").selectOption("BACKLOG");
  await page.getByRole("button", { name: "Criar atividade" }).click();
  let activity = page.getByRole("article").filter({ hasText: sharedTitle });
  await expect(activity).toBeVisible();
  await activity.getByLabel(`Nova subtask para ${sharedTitle}`).fill(sharedSubtaskTitle);
  await activity.getByRole("button", { name: "Adicionar" }).click();
  await expect(activity.getByRole("listitem").filter({ hasText: sharedSubtaskTitle })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "demo-secretary");
  await page.goto("/atividades?bucket=backlog");
  await expect(page.getByRole("heading", { name: "Atividades", exact: true })).toBeVisible();
  activity = page.getByRole("article").filter({ hasText: sharedTitle });
  await expect(activity).toBeVisible();
  const sharedSubtask = activity.getByRole("listitem").filter({ hasText: sharedSubtaskTitle });
  await sharedSubtask.getByRole("checkbox").check();
  await sharedSubtask.getByRole("button", { name: "Salvar" }).click();
  await expect(sharedSubtask.getByRole("checkbox")).toBeChecked();
  await expect(activity.getByText("1/1", { exact: true })).toBeVisible();
  await activity.getByLabel("Mover").selectOption("PARKED");
  await activity.getByRole("button", { name: "Salvar área" }).click();
  await expect(activity).toHaveCount(0);

  await page.locator("#activity-filter").selectOption("parked");
  await page.getByRole("button", { name: "Ver" }).click();
  await expect(page).toHaveURL(/bucket=parked/);
  activity = page.getByRole("article").filter({ hasText: sharedTitle });
  await expect(activity).toBeVisible();
  await expect(activity.getByRole("checkbox")).toBeChecked();
  await expect(activity.getByText("1/1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: sharedTitle })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "demo-leader");
  await page.goto("/atividades?bucket=parked");
  await expect(page.getByRole("heading", { name: "Atividades", exact: true })).toBeVisible();
  activity = page.getByRole("article").filter({ hasText: sharedTitle });
  await expect(activity).toBeVisible();
  await expect(activity.getByRole("checkbox")).toBeChecked();
  await expect(activity.getByText("1/1", { exact: true })).toBeVisible();
});
