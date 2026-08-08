import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createMembership, endMembership, updateMembershipRole } from "./membership-service";

describe("Ministry membership history service", () => {
  const suffix = Date.now().toString();
  const personIds: string[] = [];
  let actorId: string;
  let ministryId: string;
  let membershipId: string;

  const administrator = () => ({ id: actorId, role: "ADMINISTRATOR" as const });
  const startDate = new Date("2026-01-10T00:00:00.000Z");
  const roleDate = new Date("2026-03-15T00:00:00.000Z");
  const endDate = new Date("2026-06-30T00:00:00.000Z");

  beforeAll(async () => {
    const actorPerson = await prisma.person.create({ data: { fullName: `Autor T22 ${suffix}` } });
    personIds.push(actorPerson.id);
    const account = await prisma.account.create({
      data: {
        personId: actorPerson.id,
        username: `admin-t22-${suffix}`,
        email: `admin-t22-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "ADMINISTRATOR",
      },
    });
    actorId = account.id;
    const ministry = await prisma.ministry.create({ data: { name: `Ministério T22 ${suffix}` } });
    ministryId = ministry.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId } });
    await prisma.ministry.delete({ where: { id: ministryId } });
    await prisma.account.delete({ where: { id: actorId } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("allows only administrators to manage memberships", async () => {
    const person = await prisma.person.create({ data: { fullName: `Membro negado T22 ${suffix}` } });
    personIds.push(person.id);

    await expect(createMembership(
      { id: actorId, role: "SECRETARY" },
      { personId: person.id, ministryId, startDate },
    )).rejects.toThrow("Apenas administradores");
  });

  it("supports multiple memberships with role and editable start dates", async () => {
    const person = await prisma.person.create({ data: { fullName: `Membro T22 ${suffix}` } });
    personIds.push(person.id);
    const secondMinistry = await prisma.ministry.create({ data: { name: `Segundo Ministério T22 ${suffix}` } });

    const first = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });
    const second = await createMembership(administrator(), {
      personId: person.id,
      ministryId: secondMinistry.id,
      role: "LEADER",
      startDate: new Date("2026-02-01T00:00:00.000Z"),
    });
    membershipId = first.id;

    expect(first.role).toBe("MEMBER");
    expect(first.startDate).toEqual(startDate);
    expect(second.role).toBe("LEADER");
    expect(second.startDate).toEqual(new Date("2026-02-01T00:00:00.000Z"));
    await expect(prisma.ministryMembership.count({ where: { personId: person.id } })).resolves.toBe(2);
    await prisma.ministryMembership.delete({ where: { id: second.id } });
    await prisma.ministry.delete({ where: { id: secondMinistry.id } });
  });

  it("records role changes with an effective timeline date and audit values", async () => {
    const updated = await updateMembershipRole(administrator(), membershipId, { role: "LEADER", effectiveDate: roleDate });

    expect(updated.role).toBe("LEADER");
    await expect(prisma.timelineEvent.findFirst({ where: { personId: updated.personId, title: "Cargo no Ministério alterado" } })).resolves.toMatchObject({ occurredAt: roleDate });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: membershipId, action: "UPDATE_ROLE" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ role: "MEMBER" }),
      after: expect.objectContaining({ role: "LEADER" }),
    });
  });

  it("ends a membership while preserving the record and person timeline", async () => {
    const ended = await endMembership(administrator(), membershipId, { endDate });

    expect(ended.endDate).toEqual(endDate);
    await expect(prisma.ministryMembership.findUnique({ where: { id: membershipId } })).resolves.toMatchObject({ endDate });
    await expect(prisma.timelineEvent.findFirst({ where: { personId: ended.personId, title: "Vínculo ministerial encerrado" } })).resolves.toMatchObject({ occurredAt: endDate });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: membershipId, action: "END" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ endDate: null }),
      after: expect.objectContaining({ endDate: endDate.toISOString() }),
    });
  });
});
