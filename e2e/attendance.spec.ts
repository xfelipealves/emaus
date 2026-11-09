import { expect, test } from "@playwright/test";
import { hashPassword } from "../src/features/auth/password";
import { prisma } from "../src/lib/prisma";
import { createSession } from "../src/features/auth/session-service";
import { createSessionCookie } from "../src/lib/session";

test("cycles an eligible person's attendance", async ({ page }) => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({ data: { username: `t28-e2e-${suffix}`, email: `t28-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t28-valida"), role: "ADMINISTRATOR", person: { create: { fullName: `Administrador T28 ${suffix}` } } } });
  const category = await prisma.category.create({ data: { name: `Categoria T28 ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T28 ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa T28 ${suffix}` } });
  await prisma.ministryMembership.create({ data: { personId: person.id, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") } });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro T28 ${suffix}`, scheduledAt: new Date("2026-09-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });
  try {
    const session = await createSession(account.id);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto(`/encontros/${meeting.id}`);
    const row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await expect(row).toContainText("Não confirmado");
    await row.click();
    await expect(row).toContainText("Presente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect(prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).resolves.toMatchObject({ status: "PRESENT" });
    await page.reload();
    await expect(row).toContainText("Presente");

    const attendance = await prisma.attendance.findUniqueOrThrow({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } });
    await page.goto("/configuracoes/auditoria");
    const firstAudit = page.getByRole("article").filter({ hasText: `Attendance · ${attendance.id}` }).first();
    await expect(firstAudit.getByRole("heading", { name: `Attendance · ${attendance.id}` })).toBeVisible();
    await expect(firstAudit.getByText(`Pessoa: ${person.fullName} · Encontro: ${meeting.title}`, { exact: true })).toBeVisible();
    await expect(firstAudit.getByText(`Autor: Administrador T28 ${suffix}`, { exact: true })).toBeVisible();
    await expect(firstAudit.locator("time")).toHaveAttribute("datetime", /.+/);
    await expect(firstAudit.locator("pre").nth(0)).toHaveText(/{\s*"status": "NOT_CONFIRMED"\s*}/);
    await expect(firstAudit.locator("pre").nth(1)).toHaveText(/{\s*"status": "PRESENT"\s*}/);

    await page.goto(`/encontros/${meeting.id}`);
    const currentRow = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await page.getByLabel("Motivo opcional da correção").fill("Conferência da lista demo");
    await currentRow.click();
    await expect(currentRow).toContainText("Ausente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect.poll(() => prisma.auditEvent.findFirst({ where: { targetId: attendance.id, action: "UPDATE", reason: "Conferência da lista demo" } })).toMatchObject({
      actorId: account.id,
      before: { status: "PRESENT" },
      after: { status: "ABSENT" },
      reason: "Conferência da lista demo",
    });
    await expect.poll(() => prisma.timelineEvent.findFirst({ where: { personId: person.id, category: "ATTENDANCE" } })).toMatchObject({ title: "Presença atualizada" });
    await page.goto("/configuracoes/auditoria");
    const correctionAudit = page.getByRole("article").filter({ hasText: `Attendance · ${attendance.id}` }).filter({ hasText: "Conferência da lista demo" }).first();
    await expect(correctionAudit.getByText(`Pessoa: ${person.fullName} · Encontro: ${meeting.title}`, { exact: true })).toBeVisible();
    await expect(correctionAudit.getByText("Motivo: Conferência da lista demo", { exact: false })).toBeVisible();
    await expect(correctionAudit.locator("pre").nth(0)).toHaveText(/{\s*"status": "PRESENT"\s*}/);
    await expect(correctionAudit.locator("pre").nth(1)).toHaveText(/{\s*"status": "ABSENT"\s*}/);

    await page.goto(`/encontros/${meeting.id}`);
    const finalRow = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await finalRow.click();
    await expect(finalRow).toContainText("Não confirmado");
    await expect.poll(() => prisma.attendance.findUnique({ where: { id: attendance.id } })).toMatchObject({ status: "NOT_CONFIRMED" });
    await expect.poll(() => prisma.timelineEvent.count({ where: { personId: person.id } })).toBeGreaterThanOrEqual(3);
    await page.goto(`/pessoas/${person.id}/timeline?filter=attendance`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: `Timeline de ${person.fullName}` })).toBeVisible();
    await expect(page.getByText(`${meeting.title}: ABSENT → NOT_CONFIRMED`, { exact: true })).toBeVisible();
  } finally {
    const personIds = [account.personId, person.id];
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  }
});

test("recovers from a network failure and retries without a false success", async ({ page }) => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({ data: { username: `t30-network-e2e-${suffix}`, email: `t30-network-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t30-valida"), role: "ADMINISTRATOR", person: { create: { fullName: `Administrador T30 ${suffix}` } } } });
  const category = await prisma.category.create({ data: { name: `Categoria T30 ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T30 ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa T30 ${suffix}` } });
  await prisma.ministryMembership.create({ data: { personId: person.id, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") } });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro T30 ${suffix}`, scheduledAt: new Date("2026-09-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });
  try {
    const session = await createSession(account.id);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto(`/encontros/${meeting.id}`);
    const row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    let failNextPost = true;
    await page.route(`**/encontros/${meeting.id}`, async (route) => {
      if (route.request().method() === "POST" && failNextPost) {
        failNextPost = false;
        await route.abort();
        return;
      }
      await route.continue();
    });

    await row.click();
    await expect(row).toContainText("Não confirmado");
    await expect(page.getByRole("status")).toHaveText("Não foi possível salvar a presença. Tente novamente.");
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await expect(prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });

    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(row).toContainText("Presente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "PRESENT" });
  } finally {
    const personIds = [account.personId, person.id];
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  }
});

test("locks only the pending attendance row and ignores a duplicate click", async ({ page }) => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({ data: { username: `t30-lock-e2e-${suffix}`, email: `t30-lock-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t30-lock"), role: "ADMINISTRATOR", person: { create: { fullName: `Administrador T30 Lock ${suffix}` } } } });
  const category = await prisma.category.create({ data: { name: `Categoria T30 Lock ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T30 Lock ${suffix}` } });
  const firstPerson = await prisma.person.create({ data: { fullName: `Pessoa T30 Lock A ${suffix}` } });
  const secondPerson = await prisma.person.create({ data: { fullName: `Pessoa T30 Lock B ${suffix}` } });
  await prisma.ministryMembership.createMany({ data: [firstPerson, secondPerson].map(({ id: personId }) => ({ personId, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") })) });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro T30 Lock ${suffix}`, scheduledAt: new Date("2026-09-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });
  try {
    const session = await createSession(account.id);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto(`/encontros/${meeting.id}`);
    const firstRow = page.getByRole("button", { name: `Marcar ${firstPerson.fullName}` });
    const secondRow = page.getByRole("button", { name: `Marcar ${secondPerson.fullName}` });
    await page.route(`**/encontros/${meeting.id}`, async (route) => {
      if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 350));
      await route.continue();
    });

    await firstRow.evaluate((button) => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(firstRow).toBeDisabled();
    await expect(secondRow).toBeEnabled();
    await secondRow.click();
    await expect(secondRow).toContainText("Presente");
    await expect(firstRow).toContainText("Presente");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: firstPerson.id } } })).toMatchObject({ status: "PRESENT" });
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: secondPerson.id } } })).toMatchObject({ status: "PRESENT" });
    const attendances = await prisma.attendance.findMany({ where: { meetingId: meeting.id }, select: { id: true } });
    for (const attendance of attendances) {
      await expect.poll(() => prisma.auditEvent.count({ where: { targetType: "Attendance", targetId: attendance.id } })).toBe(1);
    }
    await expect.poll(() => prisma.timelineEvent.count({ where: { personId: { in: [firstPerson.id, secondPerson.id] }, category: "ATTENDANCE" } })).toBe(2);
  } finally {
    const personIds = [account.personId, firstPerson.id, secondPerson.id];
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: { in: [firstPerson.id, secondPerson.id] } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  }
});

test("lets secretaries and in-scope leaders cycle attendance and hides out-of-scope meetings", async ({ page }) => {
  const suffix = Date.now().toString();
  const category = await prisma.category.create({ data: { name: `Categoria T30 Perfis ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T30 Perfis ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa T30 Perfis ${suffix}` } });
  await prisma.ministryMembership.create({ data: { personId: person.id, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") } });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro T30 Perfis ${suffix}`, scheduledAt: new Date("2026-09-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });
  const secretary = await prisma.account.create({ data: { username: `t30-secretary-e2e-${suffix}`, email: `t30-secretary-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t30-secretary"), role: "SECRETARY", person: { create: { fullName: `Secretaria T30 ${suffix}` } } } });
  const scopedLeader = await prisma.account.create({ data: { username: `t30-leader-e2e-${suffix}`, email: `t30-leader-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t30-leader"), role: "LEADER", person: { create: { fullName: `Líder T30 ${suffix}` } }, ministryAccess: { create: { ministryId: ministry.id } } } });
  const outOfScopeLeader = await prisma.account.create({ data: { username: `t30-outside-e2e-${suffix}`, email: `t30-outside-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t30-outside"), role: "LEADER", person: { create: { fullName: `Líder Externo T30 ${suffix}` } } } });
  try {
    async function authenticate(accountId: string) {
      await page.context().clearCookies();
      const session = await createSession(accountId);
      const cookie = createSessionCookie(session.token, session.expiresAt);
      await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    }

    await authenticate(secretary.id);
    await page.goto(`/encontros/${meeting.id}`);
    const row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await expect(row).toContainText("Não confirmado");
    await row.click();
    await expect(row).toContainText("Presente");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "PRESENT" });
    await row.click();
    await expect(row).toContainText("Ausente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "ABSENT" });

    await authenticate(scopedLeader.id);
    await page.goto(`/encontros/${meeting.id}`);
    await expect(row).toContainText("Ausente");
    await row.click();
    await expect(row).toContainText("Não confirmado");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "NOT_CONFIRMED" });

    await authenticate(outOfScopeLeader.id);
    await page.goto(`/encontros/${meeting.id}`);
    await expect(page).toHaveURL(/\/encontros$/);
    await expect(page.getByText(person.fullName)).toHaveCount(0);
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "NOT_CONFIRMED" });
  } finally {
    const accountIds = [secretary.id, scopedLeader.id, outOfScopeLeader.id];
    const personIds = [person.id, secretary.personId, scopedLeader.personId, outOfScopeLeader.personId];
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: accountIds } } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  }
});

test("rolls back a cancelled meeting cycle and retries after reopening", async ({ page }) => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({ data: { username: `t28-retry-e2e-${suffix}`, email: `t28-retry-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t28-valida"), role: "ADMINISTRATOR", person: { create: { fullName: `Administrador T28 Retry ${suffix}` } } } });
  const category = await prisma.category.create({ data: { name: `Categoria T28 Retry ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T28 Retry ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa T28 Retry ${suffix}` } });
  await prisma.ministryMembership.create({ data: { personId: person.id, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") } });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro T28 Retry ${suffix}`, scheduledAt: new Date("2026-09-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });
  try {
    const session = await createSession(account.id);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto(`/encontros/${meeting.id}`);
    const row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await expect(row).toContainText("Não confirmado");

    await prisma.meeting.update({ where: { id: meeting.id }, data: { status: "CANCELLED" } });
    await row.click();
    await expect(row).toContainText("Não confirmado");
    await expect(page.getByRole("status")).toHaveText("Encontro cancelado não aceita lançamentos de presença.");
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await expect(prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });

    await prisma.meeting.update({ where: { id: meeting.id }, data: { status: "SCHEDULED" } });
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(row).toContainText("Presente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "PRESENT" });
  } finally {
    const personIds = [account.personId, person.id];
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  }
});

test("loads historical attendance after the audience ministry is archived", async ({ page }) => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({ data: { username: `t29-archive-e2e-${suffix}`, email: `t29-archive-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t29-valida"), role: "ADMINISTRATOR", person: { create: { fullName: `Administrador T29 Arquivo ${suffix}` } } } });
  const category = await prisma.category.create({ data: { name: `Categoria T29 Arquivo ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T29 Arquivo ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa T29 Arquivo ${suffix}` } });
  await prisma.ministryMembership.create({ data: { personId: person.id, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") } });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro T29 Arquivo ${suffix}`, scheduledAt: new Date("2026-09-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });
  try {
    const session = await createSession(account.id);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto(`/encontros/${meeting.id}`);
    const row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await row.click();
    await expect(row).toContainText("Presente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "PRESENT" });

    await prisma.ministry.update({ where: { id: ministry.id }, data: { status: "ARCHIVED" } });
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/encontros/${meeting.id}$`));
    await expect(row).toContainText("Presente");
    await page.getByLabel("Motivo opcional da correção").fill("Correção histórica após arquivamento");
    await row.click();
    await expect(row).toContainText("Ausente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "ABSENT" });
  } finally {
    const personIds = [account.personId, person.id];
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  }
});

test("searches and adds a person, quick visitor, and attendance summary", async ({ page }) => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({ data: { username: `t29-e2e-${suffix}`, email: `t29-e2e-${suffix}@example.test`, passwordHash: await hashPassword("senha-t29-valida"), role: "ADMINISTRATOR", person: { create: { fullName: `Administrador T29 ${suffix}` } } } });
  const category = await prisma.category.create({ data: { name: `Categoria T29 ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T29 ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa Busca T29 ${suffix}` } });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro T29 ${suffix}`, scheduledAt: new Date("2026-09-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });
  try {
    const session = await createSession(account.id);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto(`/encontros/${meeting.id}`);
    await page.getByLabel("Buscar Pessoa").fill(`Pessoa Busca T29 ${suffix}`);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: `Adicionar Pessoa Busca T29 ${suffix}` }).click();
    await expect(page.getByRole("button", { name: `Marcar ${person.fullName}` })).toContainText("Não confirmado");
    await page.getByLabel("Nome do visitante rápido").fill(`Visitante Rápido T29 ${suffix}`);
    const visitorActionResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/encontros/${meeting.id}`), { timeout: 10000 });
    await page.getByRole("button", { name: "Adicionar visitante" }).click();
    await visitorActionResponse;
    await expect(page.getByRole("status")).toHaveText("Visitante adicionado.", { timeout: 10000 });
    await expect(page.getByRole("button", { name: `Marcar Visitante Rápido T29 ${suffix}` })).toContainText("Não confirmado", { timeout: 10000 });
    await expect(page.getByText("Não confirmados: 2 · Presentes: 0 · Ausentes: 0")).toBeVisible();
  } finally {
    const people = await prisma.person.findMany({ where: { fullName: { contains: `T29 ${suffix}` } }, select: { id: true } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: people.map((item) => item.id) } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: people.map((item) => item.id) } } });
  }
});

test("recovers from an interrupted attendance action without showing a false presence", async ({ page }) => {
  const suffix = Date.now().toString();
  const account = await prisma.account.create({ data: { username: `t31-secretary-retry-${suffix}`, email: `t31-secretary-retry-${suffix}@example.test`, passwordHash: await hashPassword("senha-t31-secretaria"), role: "SECRETARY", person: { create: { fullName: `Secretária T31 ${suffix}` } } } });
  const category = await prisma.category.create({ data: { name: `Categoria T31 ${suffix}` } });
  const ministry = await prisma.ministry.create({ data: { name: `Ministério T31 ${suffix}` } });
  const person = await prisma.person.create({ data: { fullName: `Pessoa T31 ${suffix}` } });
  await prisma.ministryMembership.create({ data: { personId: person.id, ministryId: ministry.id, startDate: new Date("2026-01-01T00:00:00.000Z") } });
  const meeting = await prisma.meeting.create({ data: { categoryId: category.id, title: `Encontro QA T31 ${suffix}`, scheduledAt: new Date("2026-10-10T22:00:00.000Z"), status: "SCHEDULED", audiences: { create: { ministryId: ministry.id } } } });

  try {
    const session = await createSession(account.id);
    const cookie = createSessionCookie(session.token, session.expiresAt);
    await page.context().addCookies([{ name: cookie.name, value: cookie.value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", expires: cookie.options.expires.getTime() / 1000 }]);
    await page.goto(`/encontros/${meeting.id}`);
    const row = page.getByRole("button", { name: `Marcar ${person.fullName}` });
    await expect(row).toContainText("Não confirmado");

    let interruptNextPost = true;
    await page.route(`**/encontros/${meeting.id}`, async (route) => {
      if (route.request().method() === "POST" && interruptNextPost) {
        interruptNextPost = false;
        await route.abort();
        return;
      }
      await route.continue();
    });

    await row.click();
    await expect(row).toContainText("Não confirmado");
    await expect(page.getByRole("status")).toHaveText("Não foi possível salvar a presença. Tente novamente.");
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
    await expect(row).toBeEnabled();
    await expect(prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).resolves.toMatchObject({ status: "NOT_CONFIRMED" });

    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(row).toContainText("Presente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expect.poll(() => prisma.attendance.findUnique({ where: { meetingId_personId: { meetingId: meeting.id, personId: person.id } } })).toMatchObject({ status: "PRESENT" });

    await page.reload();
    await expect(page.getByRole("button", { name: `Marcar ${person.fullName}` })).toContainText("Presente");
  } finally {
    const personIds = [account.personId, person.id];
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  }
});
