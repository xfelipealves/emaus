import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { DEMO_PASSWORD } from "./demo-fixtures";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

test("RNF-002 supports mobile person registration and attendance by touch", async ({ page }) => {
  test.setTimeout(90_000);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const suffix = Date.now().toString();
  const registeredName = `Pessoa Cadastro Mobile ${suffix}`;
  const attendanceName = `Pessoa Frequência Mobile ${suffix}`;
  const ministryName = `Ministério Mobile ${suffix}`;
  const categoryName = `Categoria Mobile ${suffix}`;
  const meetingName = `Encontro Mobile ${suffix}`;
  let registeredPersonId: string | undefined;
  let attendancePersonId: string | undefined;
  let ministryId: string | undefined;
  let categoryId: string | undefined;
  let meetingId: string | undefined;

  try {
    await page.goto("/login");
    await expectNoHorizontalOverflow(page);
    await page.getByLabel("Nome de usuário").fill("demo-admin");
    await page.getByLabel("Senha").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).tap();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/pessoas/nova");
    await expectNoHorizontalOverflow(page);
    await page.getByLabel("Nome completo").fill(registeredName);
    await page.getByRole("button", { name: "Cadastrar Pessoa" }).tap();
    await expect(page.getByRole("status")).toHaveText("Pessoa cadastrada com sucesso.");
    registeredPersonId = new URL(page.url()).pathname.split("/").pop();
    expect(registeredPersonId).toBeTruthy();
    await expect(page.getByRole("heading", { name: registeredName })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const attendancePerson = await prisma.person.create({ data: { fullName: attendanceName, status: "MEMBER" } });
    attendancePersonId = attendancePerson.id;
    const ministry = await prisma.ministry.create({ data: { name: ministryName } });
    ministryId = ministry.id;
    const category = await prisma.category.create({ data: { name: categoryName } });
    categoryId = category.id;
    await prisma.ministryMembership.create({
      data: { personId: attendancePerson.id, ministryId, startDate: new Date("2026-09-01T00:00:00.000Z") },
    });
    const meeting = await prisma.meeting.create({
      data: {
        categoryId,
        title: meetingName,
        scheduledAt: new Date("2026-10-10T18:00:00.000Z"),
        status: "SCHEDULED",
        audiences: { create: { ministryId } },
      },
    });
    meetingId = meeting.id;

    await page.goto(`/encontros/${meeting.id}`);
    await expect(page.getByRole("heading", { name: meetingName })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const attendanceButton = page.getByRole("button", { name: `Marcar ${attendanceName}` });
    await expect(attendanceButton).toContainText("Não confirmado");
    await attendanceButton.tap();
    await expect(attendanceButton).toContainText("Presente");
    await expect(page.getByRole("status")).toHaveText("Presença salva.");
    await expectNoHorizontalOverflow(page);

    console.log(`MOBILE_RESULT ${JSON.stringify({ viewport, registration: "passed", attendanceTouch: "passed" })}`);
  } finally {
    if (meetingId) {
      const attendanceIds = await prisma.attendance.findMany({ where: { meetingId }, select: { id: true } });
      await prisma.auditEvent.deleteMany({ where: { targetId: { in: attendanceIds.map(({ id }) => id) } } });
      await prisma.attendance.deleteMany({ where: { meetingId } });
      await prisma.meetingAudience.deleteMany({ where: { meetingId } });
      await prisma.meeting.deleteMany({ where: { id: meetingId } });
    }
    if (attendancePersonId) {
      await prisma.auditEvent.deleteMany({ where: { targetId: attendancePersonId } });
      await prisma.timelineEvent.deleteMany({ where: { personId: attendancePersonId } });
      await prisma.ministryMembership.deleteMany({ where: { personId: attendancePersonId } });
      await prisma.person.deleteMany({ where: { id: attendancePersonId } });
    }
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (ministryId) await prisma.ministry.deleteMany({ where: { id: ministryId } });
    if (registeredPersonId) {
      await prisma.auditEvent.deleteMany({ where: { targetId: registeredPersonId } });
      await prisma.timelineEvent.deleteMany({ where: { personId: registeredPersonId } });
      await prisma.person.deleteMany({ where: { id: registeredPersonId } });
    }
    await prisma.$disconnect();
  }
});
