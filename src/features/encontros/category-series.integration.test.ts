import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createCategory, updateCategory } from "./category-service";
import { createSeries, generateSeriesOccurrences } from "./series-service";

describe("meeting categories and series", () => {
  const suffix = Date.now().toString();
  let actorId: string;
  let personId: string;
  let categoryId: string;
  let seriesId: string;

  const administrator = () => ({ id: actorId, role: "ADMINISTRATOR" as const, ministryAccess: [] });

  beforeAll(async () => {
    const person = await prisma.person.create({ data: { fullName: `Administrador T25 ${suffix}` } });
    personId = person.id;
    const account = await prisma.account.create({ data: { personId, username: `admin-t25-${suffix}`, email: `admin-t25-${suffix}@example.test`, passwordHash: "test-hash", role: "ADMINISTRATOR" } });
    actorId = account.id;
  });

  afterAll(async () => {
    if (seriesId) {
      await prisma.meeting.deleteMany({ where: { seriesId } });
      await prisma.meetingSeries.delete({ where: { id: seriesId } });
      await prisma.auditEvent.deleteMany({ where: { targetType: "MeetingSeries", targetId: seriesId } });
    }
    if (categoryId) {
      await prisma.auditEvent.deleteMany({ where: { targetType: "Category", targetId: categoryId } });
      await prisma.category.delete({ where: { id: categoryId } });
    }
    await prisma.account.delete({ where: { id: actorId } });
    await prisma.person.delete({ where: { id: personId } });
    await prisma.$disconnect();
  });

  it("allows administrators to create and edit categories, while denying secretaries", async () => {
    await expect(createCategory({ id: actorId, role: "SECRETARY", ministryAccess: [] }, { name: "Negada" })).rejects.toThrow("Apenas administradores");
    const category = await createCategory(administrator(), { name: `Cultos T25 ${suffix}`, description: "Categoria inicial" });
    categoryId = category.id;
    const updated = await updateCategory(administrator(), categoryId, { name: `Cultos atualizados T25 ${suffix}` });
    expect(updated.name).toBe(`Cultos atualizados T25 ${suffix}`);
  });

  it("creates recurrence occurrences independently and does not duplicate generation", async () => {
    const series = await createSeries(administrator(), {
      categoryId,
      name: `Série T25 ${suffix}`,
      recurrence: "BIWEEKLY",
      weekdays: [1, 3],
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
    });
    seriesId = series.id;
    const first = await generateSeriesOccurrences(administrator(), seriesId, new Date("2026-01-31T00:00:00.000Z"));
    const second = await generateSeriesOccurrences(administrator(), seriesId, new Date("2026-01-31T00:00:00.000Z"));
    expect(first).toHaveLength(4);
    expect(second).toHaveLength(4);
    expect(new Set(second.map((meeting) => meeting.id)).size).toBe(4);
    expect(new Set(second.map((meeting) => meeting.seriesId)).size).toBe(1);
    expect(second.every((meeting) => meeting.title === `Série T25 ${suffix}`)).toBe(true);
  });
});
