import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  archiveMinistry,
  assertMinistryActive,
  createMinistry,
  updateMinistry,
} from "./ministry-service";

describe("Ministry administration", () => {
  const suffix = Date.now().toString();
  let actorId: string;
  let personId: string;
  let ministryId: string;

  const administrator = () => ({
    id: actorId,
    role: "ADMINISTRATOR" as const,
    ministryAccess: [],
  });

  beforeAll(async () => {
    const person = await prisma.person.create({ data: { fullName: `Administrador T21 ${suffix}` } });
    personId = person.id;
    const account = await prisma.account.create({
      data: {
        personId,
        username: `admin-t21-${suffix}`,
        email: `admin-t21-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "ADMINISTRATOR",
      },
    });
    actorId = account.id;
  });

  afterAll(async () => {
    if (ministryId) {
      await prisma.auditEvent.deleteMany({ where: { targetType: "Ministry", targetId: ministryId } });
      await prisma.ministryMembership.deleteMany({ where: { ministryId } });
      await prisma.ministry.delete({ where: { id: ministryId } });
    }
    await prisma.account.delete({ where: { id: actorId } });
    await prisma.person.delete({ where: { id: personId } });
    await prisma.$disconnect();
  });

  it("allows only administrators to create, edit and archive ministries", async () => {
    await expect(createMinistry({ id: actorId, role: "SECRETARY", ministryAccess: [] }, { name: "Negado" })).rejects.toThrow("Apenas administradores");

    const ministry = await createMinistry(administrator(), { name: "Ministério T21", description: "Descrição inicial" });
    ministryId = ministry.id;
    const updated = await updateMinistry(administrator(), ministryId, { name: "Ministério T21 atualizado" });
    const archived = await archiveMinistry(administrator(), ministryId);

    expect(updated.name).toBe("Ministério T21 atualizado");
    expect(archived.status).toBe("ARCHIVED");
  });

  it("preserves history and blocks new operations after archive", async () => {
    await prisma.ministryMembership.create({
      data: {
        ministryId,
        personId,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    await expect(assertMinistryActive(ministryId)).rejects.toThrow("Ministério arquivado");
    const history = await prisma.ministryMembership.findMany({ where: { ministryId } });
    expect(history).toHaveLength(1);
    expect(history[0]?.ministryId).toBe(ministryId);
  });

  it("audits creation, edit and archive with before and after values", async () => {
    const events = await prisma.auditEvent.findMany({
      where: { targetType: "Ministry", targetId: ministryId },
      orderBy: { createdAt: "asc" },
    });

    expect(events.map((event) => event.action)).toEqual(["CREATE", "UPDATE", "ARCHIVE"]);
    expect(events[0]?.after).toMatchObject({ name: "Ministério T21", status: "ACTIVE" });
    expect(events[1]?.before).toMatchObject({ name: "Ministério T21", status: "ACTIVE" });
    expect(events[1]?.after).toMatchObject({ name: "Ministério T21 atualizado", status: "ACTIVE" });
    expect(events[2]?.before).toMatchObject({ status: "ACTIVE" });
    expect(events[2]?.after).toMatchObject({ status: "ARCHIVED" });
  });
});
