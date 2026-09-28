import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD } from "./demo-fixtures";
import { prisma } from "../src/lib/prisma";

function brazilDateOffset(days: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]));
  return new Date(Date.UTC(value.year, value.month - 1, value.day + days)).toISOString().slice(0, 10);
}

function brazilDateDisplay(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

test.describe("P1 Person lifecycle", () => {
  test.describe.configure({ mode: "serial" });

  test("PES-01/PES-02 — registers a visitor, promotes it, then preserves its history when inactive", async ({ page }) => {
    const suffix = Date.now().toString();
    const fullName = `Pessoa ciclo T35 ${suffix}`;
    let personId: string | undefined;
    let duplicatePersonId: string | undefined;
    let ministryId: string | undefined;
    let categoryId: string | undefined;
    let meetingId: string | undefined;
    const noteContent = `Nota preservada ciclo T35 ${suffix}`;
    const promotionDate = brazilDateOffset(1);
    const inactivationDate = brazilDateOffset(2);

    try {
      await page.goto("/login", { waitUntil: "load" });
      await page.getByLabel("Nome de usuário").fill("demo-admin");
      await page.getByLabel("Senha").fill(DEMO_PASSWORD);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/$/);

      const duplicateSeed = await prisma.person.create({ data: { fullName } });
      duplicatePersonId = duplicateSeed.id;
      await page.goto("/pessoas/nova", { waitUntil: "load" });
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
      await expect(page.locator("dd").nth(1)).toHaveText("Não informado");
      await expect(prisma.person.count({ where: { fullName } })).resolves.toBe(2);
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId } })).toMatchObject({ fullName, status: "VISITOR", phone: null, birthDate: null });
      await expect.poll(() => prisma.timelineEvent.findFirst({ where: { personId: createdPersonId, category: "REGISTRATION" } })).toMatchObject({ title: "Pessoa cadastrada" });

      const phoneInput = page.getByLabel("Telefone para promoção");
      const birthDateInput = page.getByLabel("Data de nascimento para promoção");
      const promotionDateInput = page.getByLabel("Data efetiva da promoção");
      await expect(promotionDateInput).toHaveValue(brazilDateOffset(0));

      await phoneInput.fill("");
      await page.getByRole("button", { name: "Promover a membro" }).click();
      await expect(phoneInput).toBeFocused();
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId }, select: { status: true, phone: true, birthDate: true } })).toEqual({ status: "VISITOR", phone: null, birthDate: null });

      await phoneInput.fill("(00) 00000-3510");
      await birthDateInput.fill("");
      await page.getByRole("button", { name: "Promover a membro" }).click();
      await expect(birthDateInput).toBeFocused();
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId }, select: { status: true, phone: true, birthDate: true } })).toEqual({ status: "VISITOR", phone: null, birthDate: null });

      await birthDateInput.fill("1995-04-12");
      await promotionDateInput.fill(promotionDate);
      await page.getByRole("button", { name: "Promover a membro" }).click();
      await expect(page).toHaveURL(/status=promoted/);
      await expect(page.getByRole("status")).toHaveText("Pessoa promovida a membro.");
      await expect(prisma.person.findUnique({ where: { id: createdPersonId } })).resolves.toMatchObject({ status: "MEMBER", phone: "(00) 00000-3510" });
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId }, select: { statusChangedAt: true } })).toEqual({ statusChangedAt: new Date(`${promotionDate}T12:00:00.000Z`) });

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

      await page.getByLabel("Nova nota").fill(noteContent);
      await page.getByRole("button", { name: "Adicionar nota" }).click();
      await expect(page.getByText("Nota adicionada.", { exact: true })).toBeVisible();
      const note = await prisma.note.findFirstOrThrow({ where: { personId: createdPersonId, content: noteContent } });
      const demoAdmin = await prisma.account.findUniqueOrThrow({ where: { username: "demo-admin" }, select: { id: true } });
      expect(note.authorId).toBe(demoAdmin.id);
      await expect(prisma.noteVersion.findMany({ where: { noteId: note.id }, select: { authorId: true, content: true, sequence: true } })).resolves.toEqual([
        { authorId: demoAdmin.id, content: noteContent, sequence: 1 },
      ]);

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByLabel("Data efetiva da inativação").fill(inactivationDate);
      await page.getByRole("button", { name: "Inativar Pessoa" }).click();
      await expect(page).toHaveURL(/status=inactivated/);
      await expect(page.getByRole("status")).toHaveText("Pessoa inativada. O histórico foi preservado.");
      await page.reload();
      await expect(page.getByRole("status")).toHaveText("Pessoa inativada. O histórico foi preservado.");
      await expect(page.getByText("Inativa", { exact: true })).toBeVisible();
      await expect(page.getByText(`Ministério ciclo T35 ${suffix}`, { exact: true })).toBeVisible();

      await expect(prisma.person.findUnique({ where: { id: createdPersonId }, include: { memberships: true, attendances: true } })).resolves.toMatchObject({
        id: createdPersonId,
        status: "INACTIVE",
        memberships: [{ ministryId }],
        attendances: [{ meetingId, status: "PRESENT" }],
      });
      await expect(prisma.timelineEvent.count({ where: { personId: createdPersonId } })).resolves.toBe(4);
      await expect(prisma.timelineEvent.findMany({ where: { personId: createdPersonId, category: "STATUS" }, orderBy: { occurredAt: "asc" }, select: { title: true, occurredAt: true } })).resolves.toEqual([
        { title: "Pessoa promovida a membro", occurredAt: new Date(`${promotionDate}T12:00:00.000Z`) },
        { title: "Pessoa inativada", occurredAt: new Date(`${inactivationDate}T12:00:00.000Z`) },
      ]);
      await expect.poll(() => prisma.person.findUnique({ where: { id: createdPersonId }, select: { statusChangedAt: true } })).toEqual({ statusChangedAt: new Date(`${inactivationDate}T12:00:00.000Z`) });
      await expect(page.getByRole("textbox", { name: "Nota", exact: true })).toHaveValue(noteContent);
      await expect(prisma.note.findUnique({ where: { id: note.id }, include: { versions: true } })).resolves.toMatchObject({
        personId: createdPersonId,
        authorId: demoAdmin.id,
        content: noteContent,
        archived: false,
        versions: [{ authorId: demoAdmin.id, content: noteContent, sequence: 1 }],
      });
      await expect(prisma.auditEvent.findMany({ where: { targetId: createdPersonId }, orderBy: { createdAt: "asc" }, select: { action: true } })).resolves.toEqual([
        { action: "CREATE" },
        { action: "PROMOTE_TO_MEMBER" },
        { action: "INACTIVATE" },
      ]);

      await page.getByRole("link", { name: "Timeline" }).click();
      await expect(page).toHaveURL(new RegExp(`/pessoas/${createdPersonId}/timeline$`));
      await expect(page.getByRole("heading", { name: "Pessoa inativada" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Pessoa promovida a membro" })).toBeVisible();
      const inactiveEvent = page.locator('section[aria-label="Eventos da timeline"] li').filter({ has: page.getByRole("heading", { name: "Pessoa inativada" }) });
      await expect(inactiveEvent.getByRole("time")).toHaveText(brazilDateDisplay(inactivationDate));
    } finally {
      if (personId) {
        const notes = await prisma.note.findMany({ where: { personId }, select: { id: true } });
        await prisma.auditEvent.deleteMany({ where: { targetId: { in: [personId, ...notes.map(({ id }) => id)] } } });
        await prisma.timelineEvent.deleteMany({ where: { personId } });
        await prisma.noteVersion.deleteMany({ where: { note: { personId } } });
        await prisma.note.deleteMany({ where: { personId } });
        await prisma.attendance.deleteMany({ where: { personId } });
        await prisma.ministryMembership.deleteMany({ where: { personId } });
      }
      if (duplicatePersonId) {
        await prisma.auditEvent.deleteMany({ where: { targetId: duplicatePersonId } });
        await prisma.timelineEvent.deleteMany({ where: { personId: duplicatePersonId } });
        await prisma.person.deleteMany({ where: { id: duplicatePersonId } });
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
