import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { DEMO_PASSWORD } from "./demo-fixtures";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString(36);
const titlePrefix = `E2E atividades ${runId}`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Nome de usuário").fill("demo-admin");
  await page.getByLabel("Senha").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
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
  await expect(page.getByRole("heading", { name: "Atividades" })).toBeVisible();

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

  await page.locator("#activity-filter").selectOption("all");
  await page.getByRole("button", { name: "Ver" }).click();
  const activity = page.getByRole("article").filter({ hasText: tomorrowTitle });

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
  await page.once("dialog", (dialog) => dialog.dismiss());
  await deleteActivityButton.click();
  await expect(activity).toBeVisible();
  await expect(cascadeSubtask).toBeVisible();

  await page.once("dialog", (dialog) => dialog.accept());
  await deleteActivityButton.click();
  await expect(activity).toHaveCount(0);
  await expect.poll(async () => prisma.activity.count({ where: { title: tomorrowTitle } })).toBe(0);
  await expect.poll(async () => prisma.activitySubtask.count({ where: { title: cascadeSubtaskTitle } })).toBe(0);
  await expect(page.getByRole("heading", { name: "Nova atividade" })).toBeVisible();
});
