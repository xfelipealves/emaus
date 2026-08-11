import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";
import { createSession } from "../src/features/auth/session-service";
import { createSessionCookie } from "../src/lib/session";

test.describe("meeting creation", () => {
  const username = "t26-meeting-admin";
  let categoryId: string;
  let ministryId: string;
  let accountId: string;

  test.beforeAll(async () => {
    const previous = await prisma.account.findUnique({ where: { username } });
    if (previous) {
      await prisma.account.delete({ where: { id: previous.id } });
      await prisma.person.delete({ where: { id: previous.personId } });
    }
    const account = await prisma.account.create({ data: { username, email: `${username}@example.test`, passwordHash: await hashPassword("senha-t26-valida"), role: "ADMINISTRATOR", person: { create: { fullName: "Administrador T26 E2E" } } } });
    accountId = account.id;
    const category = await prisma.category.create({ data: { name: "Categoria E2E T26" } });
    const ministry = await prisma.ministry.create({ data: { name: "Ministério E2E T26" } });
    categoryId = category.id;
    ministryId = ministry.id;
  });

  test.afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: accountId } });
    const meetings = await prisma.meeting.findMany({ where: { categoryId }, select: { id: true } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: { in: meetings.map((meeting) => meeting.id) } } });
    await prisma.meeting.deleteMany({ where: { categoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.ministry.delete({ where: { id: ministryId } });
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (account) {
      await prisma.account.delete({ where: { id: accountId } });
      await prisma.person.delete({ where: { id: account.personId } });
    }
  });

  test("creates a scheduled meeting with a selected ministry audience", async ({ page }) => {
    const session = await createSession(accountId);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto("/encontros/nova");
    await page.getByLabel("Título").fill("Encontro E2E T26");
    await page.getByLabel("Categoria").selectOption(categoryId);
    await page.getByLabel("Data e horário").fill("2026-09-10T19:00");
    await page.getByLabel("Ministérios selecionados").check();
    await page.getByLabel("Ministério E2E T26").check();
    await page.getByRole("button", { name: "Criar encontro" }).click();
    await expect(page.getByRole("status")).toHaveText("Encontro criado com sucesso.", { timeout: 30_000 });
    await page.goto("/encontros");
    await expect(page.getByRole("heading", { name: "Encontro E2E T26" })).toBeVisible();
    await expect(page.getByText("Ministério E2E T26")).toBeVisible();
    await expect.poll(() => prisma.meeting.findFirst({ where: { title: "Encontro E2E T26" }, select: { scheduledAt: true } })).toEqual({ scheduledAt: new Date("2026-09-10T22:00:00.000Z") });
    await expect(page.getByText(/10\/09\/2026/)).toBeVisible();
  });

  test("confirms cancellation before creating a cancelled meeting", async ({ page }) => {
    const session = await createSession(accountId);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto("/encontros/nova");
    await page.getByLabel("Título").fill("Encontro E2E T26 cancelado");
    await page.getByLabel("Categoria").selectOption(categoryId);
    await page.getByLabel("Data e horário").fill("2026-09-11T19:00");
    await page.getByLabel("Estado").selectOption("CANCELLED");

    let dialogMessage = "";
    page.once("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Criar encontro" }).click();
    expect(dialogMessage).toBe("Cancelar este encontro? Ele ficará preservado para consulta e não aceitará presença.");
    await expect(prisma.meeting.findFirst({ where: { title: "Encontro E2E T26 cancelado" } })).resolves.toBeNull();
    await expect(page.getByRole("status")).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Criar encontro" }).click();
    await expect(page.getByRole("status")).toHaveText("Encontro criado com sucesso.", { timeout: 30_000 });
    await expect.poll(() => prisma.meeting.findFirst({ where: { title: "Encontro E2E T26 cancelado" }, select: { status: true } })).toEqual({ status: "CANCELLED" });
  });
});
