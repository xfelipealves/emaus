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
  } finally {
    await prisma.auditEvent.deleteMany({ where: { actorId: account.id } });
    await prisma.timelineEvent.deleteMany({ where: { personId: person.id } });
    await prisma.attendance.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.ministryMembership.deleteMany({ where: { personId: person.id } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: meeting.id } });
    await prisma.meeting.delete({ where: { id: meeting.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
    await prisma.account.delete({ where: { id: account.id } });
    await prisma.person.deleteMany({ where: { id: { in: [account.personId, person.id] } } });
  }
});
