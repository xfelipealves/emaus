import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD } from "./demo-fixtures";
import { prisma } from "../src/lib/prisma";

test.describe("P1 Person lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test("PES-01/PES-02 — registers a visitor, promotes it, then preserves its history when inactive", async ({ page }) => {
    const suffix = Date.now().toString();
    const fullName = `Pessoa ciclo T35 ${suffix}`;
    let personId: string | undefined;
    let ministryId: string | undefined;
    let categoryId: string | undefined;
    let meetingId: string | undefined;

    try {
      await page.goto("/login");
      await page.getByLabel("Nome de usuário").fill("demo-admin");
      await page.getByLabel("Senha").fill(DEMO_PASSWORD);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/$/);

      await page.goto("/pessoas/nova");
      await page.getByLabel("Nome completo").fill(fullName);
      await page.getByRole("button", { name: "Cadastrar Pessoa" }).click();
      await expect(page).not.toHaveURL(/\/pessoas\/nova$/, { timeout: 30_000 });
      await expect(page).toHaveURL(/\/pessoas\/[^/]+(?:\?.*)?$/);
      await expect(page.getByRole("status")).toHaveText("Pessoa cadastrada com sucesso.");
      const createdPersonId = new URL(page.url()).pathname.split("/").pop();
      if (!createdPersonId) throw new Error("Person registration did not return an id");
      personId = createdPersonId;
      await expect(page.getByRole("heading", { name: fullName })).toBeVisible();
      await expect(page.getByText("Visitante", { exact: true })).toBeVisible();
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId } })).toMatchObject({ fullName, status: "VISITOR" });
      await expect.poll(() => prisma.timelineEvent.findFirst({ where: { personId: createdPersonId, category: "REGISTRATION" } })).toMatchObject({ title: "Pessoa cadastrada" });

      await page.getByLabel("Telefone para promoção").fill("(00) 00000-3510");
      await page.getByLabel("Data de nascimento para promoção").fill("1995-04-12");
      await page.getByLabel("Data efetiva da promoção").fill("2026-07-15");
      await page.getByRole("button", { name: "Promover a membro" }).click();
      await expect(page).toHaveURL(/status=promoted/);
      await expect(page.getByRole("status")).toHaveText("Pessoa promovida a membro.");
      await expect(prisma.person.findUnique({ where: { id: createdPersonId } })).resolves.toMatchObject({ status: "MEMBER", phone: "(00) 00000-3510" });
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId }, select: { statusChangedAt: true } })).toEqual({ statusChangedAt: new Date("2026-07-15T12:00:00.000Z") });

      await page.reload();
      await expect(page.getByText("Membro", { exact: true })).toBeVisible();
      await expect(page.getByText("(00) 00000-3510")).toBeVisible();
      await expect(page.locator("dd").nth(1)).toContainText("31 anos");

      const ministry = await prisma.ministry.create({ data: { name: `Ministério ciclo T35 ${suffix}` } });
      ministryId = ministry.id;
      const category = await prisma.category.create({ data: { name: `Categoria ciclo T35 ${suffix}` } });
      categoryId = category.id;
      await prisma.ministryMembership.create({ data: { personId: createdPersonId, ministryId, role: "MEMBER", startDate: new Date("2026-01-01T00:00:00.000Z") } });
      const meeting = await prisma.meeting.create({
        data: {
          categoryId,
          title: `Encontro ciclo T35 ${suffix}`,
          scheduledAt: new Date("2026-09-10T22:00:00.000Z"),
          status: "SCHEDULED",
          audiences: { create: { ministryId } },
          attendances: { create: { personId: createdPersonId, status: "PRESENT" } },
        },
      });
      meetingId = meeting.id;

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByLabel("Data efetiva da inativação").fill("2026-07-20");
      await page.getByRole("button", { name: "Inativar Pessoa" }).click();
      await expect(page).toHaveURL(/status=inactivated/);
      await expect(page.getByRole("status")).toHaveText("Pessoa inativada. O histórico foi preservado.");
      await expect(page.getByText("Inativa", { exact: true })).toBeVisible();
      await expect(page.getByText(`Ministério ciclo T35 ${suffix}`, { exact: true })).toBeVisible();

      await expect(prisma.person.findUnique({ where: { id: createdPersonId }, include: { memberships: true, attendances: true } })).resolves.toMatchObject({
        id: createdPersonId,
        status: "INACTIVE",
        memberships: [{ ministryId }],
        attendances: [{ meetingId, status: "PRESENT" }],
      });
      await expect(prisma.timelineEvent.count({ where: { personId: createdPersonId } })).resolves.toBe(3);
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId }, select: { statusChangedAt: true } })).toEqual({ statusChangedAt: new Date("2026-07-20T12:00:00.000Z") });
      await expect(prisma.auditEvent.findMany({ where: { targetId: createdPersonId }, orderBy: { createdAt: "asc" }, select: { action: true } })).resolves.toEqual([
        { action: "CREATE" },
        { action: "PROMOTE_TO_MEMBER" },
        { action: "INACTIVATE" },
      ]);
    } finally {
      if (personId) {
        await prisma.auditEvent.deleteMany({ where: { targetId: personId } });
        await prisma.timelineEvent.deleteMany({ where: { personId } });
        await prisma.attendance.deleteMany({ where: { personId } });
        await prisma.ministryMembership.deleteMany({ where: { personId } });
      }
      if (meetingId) {
        await prisma.meetingAudience.deleteMany({ where: { meetingId } });
        await prisma.meeting.delete({ where: { id: meetingId } });
      }
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
      if (ministryId) await prisma.ministry.delete({ where: { id: ministryId } });
      if (personId) await prisma.person.deleteMany({ where: { id: personId } });
    }
  });
});
