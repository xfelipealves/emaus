import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createMembership, endMembership, getMinistryMembershipManagement, updateMembershipRole } from "./membership-service";
import { getPersonTimeline } from "../timeline/timeline-query";

describe("Ministry membership history service", () => {
  const suffix = Date.now().toString();
  const personIds: string[] = [];
  let actorId: string;
  let actorName: string;
  let ministryId: string;
  let ministryName: string;
  let membershipId: string;

  const administrator = () => ({ id: actorId, role: "ADMINISTRATOR" as const });
  const startDate = new Date("2026-01-10T00:00:00.000Z");
  const roleDate = new Date("2026-03-15T00:00:00.000Z");
  const endDate = new Date("2026-06-30T00:00:00.000Z");

  beforeAll(async () => {
    actorName = `Autor T22 ${suffix}`;
    const actorPerson = await prisma.person.create({ data: { fullName: actorName } });
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
    ministryName = `Ministério T22 ${suffix}`;
    const ministry = await prisma.ministry.create({ data: { name: ministryName } });
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
      { personId: person.id, ministryId, role: "MEMBER", startDate },
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

  it("keeps person, ministry, actor, role changes, and entry and exit dates in history queries", async () => {
    const person = await prisma.person.create({ data: { fullName: `Histórico T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), {
      personId: person.id,
      ministryId,
      role: "MEMBER",
      startDate,
    });

    const creationEvents = await getPersonTimeline(administrator(), person.id, "ministries");
    expect(creationEvents).toHaveLength(1);
    expect(creationEvents[0]).toMatchObject({
      personId: person.id,
      title: "Pessoa vinculada ao Ministério",
      actor: { id: actorId, fullName: actorName },
    });
    expect(creationEvents[0]?.description).toContain(person.fullName);
    expect(creationEvents[0]?.description).toContain(ministryName);
    expect(creationEvents[0]?.description).toContain("Membro");

    await updateMembershipRole(administrator(), membership.id, { role: "LEADER", effectiveDate: roleDate });
    await endMembership(administrator(), membership.id, { endDate });

    const history = await getMinistryMembershipManagement(administrator(), ministryId);
    expect(history?.currentMemberships).toEqual([]);
    expect(history?.historicMemberships.find(({ id }) => id === membership.id)).toMatchObject({
      id: membership.id,
      role: "LEADER",
      startDate,
      endDate,
      person: expect.objectContaining({ id: person.id, fullName: person.fullName }),
    });

    const events = await getPersonTimeline(administrator(), person.id, "ministries");
    expect(events.map(({ title }) => title)).toEqual([
      "Vínculo ministerial encerrado",
      "Cargo no Ministério alterado",
      "Pessoa vinculada ao Ministério",
    ]);
    expect(events.every((event) => event.actor?.fullName === actorName)).toBe(true);
    expect(events.every((event) => event.description?.includes(ministryName))).toBe(true);
    expect(events[1]?.description).toContain("Membro");
    expect(events[1]?.description).toContain("Líder");
  });
});
