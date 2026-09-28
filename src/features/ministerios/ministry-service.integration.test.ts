import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  archiveMinistry,
  assertMinistryActive,
  createMinistry,
  getMinistryProfile,
  listMinistries,
  updateMinistry,
} from "./ministry-service";

describe("Ministry administration", () => {
  const suffix = Date.now().toString();
  let actorId: string;
  let personId: string;
  let leaderId: string;
  let leaderPersonId: string;
  let ministryId: string;
  let scopedMinistryId: string;
  let unscopedMinistryId: string;
  let archivedMinistryId: string;

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

    const leaderPerson = await prisma.person.create({ data: { fullName: `Líder T21 ${suffix}` } });
    leaderPersonId = leaderPerson.id;
    const leader = await prisma.account.create({
      data: {
        personId: leaderPersonId,
        username: `leader-t21-${suffix}`,
        email: `leader-t21-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "LEADER",
      },
    });
    leaderId = leader.id;

    const [scopedMinistry, unscopedMinistry, archivedMinistry] = await Promise.all([
      prisma.ministry.create({ data: { name: `Ministério concedido T21 ${suffix}` } }),
      prisma.ministry.create({ data: { name: `Ministério fora do escopo T21 ${suffix}` } }),
      prisma.ministry.create({ data: { name: `Ministério arquivado T21 ${suffix}`, status: "ARCHIVED" } }),
    ]);
    scopedMinistryId = scopedMinistry.id;
    unscopedMinistryId = unscopedMinistry.id;
    archivedMinistryId = archivedMinistry.id;
    await prisma.accountMinistryAccess.createMany({
      data: [
        { accountId: leaderId, ministryId: scopedMinistryId },
        { accountId: leaderId, ministryId: archivedMinistryId },
      ],
    });
  });

  afterAll(async () => {
    const ministryIds = [ministryId, scopedMinistryId, unscopedMinistryId, archivedMinistryId].filter((id): id is string => Boolean(id));
    await prisma.auditEvent.deleteMany({ where: { OR: [{ actorId }, { targetId: { in: ministryIds } }] } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: leaderId } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: ministryIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: ministryIds } } });
    await prisma.account.delete({ where: { id: leaderId } });
    await prisma.person.delete({ where: { id: leaderPersonId } });
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

  it("lists active ministries from persisted Leader grants and isolates other scopes", async () => {
    const ministries = await listMinistries({ id: leaderId, role: "LEADER", ministryAccess: [] });
    expect(ministries.map((ministry) => ({ id: ministry.id, status: ministry.status }))).toEqual([
      { id: scopedMinistryId, status: "ACTIVE" },
    ]);
    await expect(getMinistryProfile({ id: leaderId, role: "LEADER" }, scopedMinistryId)).resolves.toMatchObject({ id: scopedMinistryId });
    await expect(getMinistryProfile({ id: leaderId, role: "LEADER" }, unscopedMinistryId)).resolves.toBeNull();
    await expect(listMinistries({ id: leaderId, role: "ADMINISTRATOR", ministryAccess: [] })).resolves.toEqual([]);
  });

  it("stops listing and viewing a Ministry after its Leader grant is revoked", async () => {
    await prisma.accountMinistryAccess.updateMany({
      where: { accountId: leaderId, ministryId: scopedMinistryId },
      data: { revokedAt: new Date() },
    });

    await expect(listMinistries({ id: leaderId, role: "LEADER", ministryAccess: [] })).resolves.toEqual([]);
    await expect(getMinistryProfile({ id: leaderId, role: "LEADER" }, scopedMinistryId)).resolves.toBeNull();
  });

  it("does not return scoped ministries for an inactive Leader account", async () => {
    await prisma.accountMinistryAccess.updateMany({
      where: { accountId: leaderId, ministryId: scopedMinistryId },
      data: { revokedAt: null },
    });
    await prisma.account.update({ where: { id: leaderId }, data: { status: "INACTIVE" } });

    await expect(listMinistries({ id: leaderId, role: "LEADER", ministryAccess: [] })).resolves.toEqual([]);
    await expect(getMinistryProfile({ id: leaderId, role: "LEADER" }, scopedMinistryId)).resolves.toBeNull();
  });
});
