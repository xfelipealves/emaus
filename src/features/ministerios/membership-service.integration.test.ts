import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createMembership, endMembership, getMinistryMembershipManagement, updateMembershipRole } from "./membership-service";

describe("Ministry membership history service", () => {
  const suffix = Date.now().toString();
  const personIds: string[] = [];
  const ministryIds: string[] = [];
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
    ministryIds.push(ministry.id);
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: ministryIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: ministryIds } } });
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
    ministryIds.push(secondMinistry.id);

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
    ministryIds.splice(ministryIds.indexOf(secondMinistry.id), 1);
  });

  it("rejects a duplicate active membership without adding history or audit events", async () => {
    const person = await prisma.person.create({ data: { fullName: `Duplicada T22 ${suffix}` } });
    personIds.push(person.id);
    const created = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });

    await expect(createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate })).rejects.toThrow("vínculo vigente");

    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId } })).resolves.toBe(1);
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(1);
    await expect(prisma.auditEvent.count({ where: { targetId: created.id, action: "CREATE" } })).resolves.toBe(1);
  });

  it("allows re-entry only after the previous membership ends", async () => {
    const person = await prisma.person.create({ data: { fullName: `Reentrada T22 ${suffix}` } });
    personIds.push(person.id);
    const previous = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });
    const priorEndDate = new Date("2026-03-01T00:00:00.000Z");
    await endMembership(administrator(), previous.id, { endDate: priorEndDate });

    const next = await createMembership(administrator(), {
      personId: person.id,
      ministryId,
      role: "MEMBER",
      startDate: new Date("2026-03-02T00:00:00.000Z"),
    });

    expect(next.startDate).toEqual(new Date("2026-03-02T00:00:00.000Z"));
    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId } })).resolves.toBe(2);
    await expect(prisma.ministryMembership.findUnique({ where: { id: previous.id } })).resolves.toMatchObject({ endDate: priorEndDate });
  });

  it("rejects a re-entry whose start overlaps the previous end date", async () => {
    const person = await prisma.person.create({ data: { fullName: `Sobreposição T22 ${suffix}` } });
    personIds.push(person.id);
    const previous = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });
    await endMembership(administrator(), previous.id, { endDate: new Date("2026-03-01T00:00:00.000Z") });

    await expect(createMembership(administrator(), {
      personId: person.id,
      ministryId,
      role: "MEMBER",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
    })).rejects.toThrow("posterior à saída");

    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId } })).resolves.toBe(1);
  });

  it("rejects an invalid entry date before touching membership history", async () => {
    const person = await prisma.person.create({ data: { fullName: `Datas T22 ${suffix}` } });
    personIds.push(person.id);

    await expect(createMembership(administrator(), {
      personId: person.id,
      ministryId,
      role: "MEMBER",
      startDate: new Date("invalid"),
    })).rejects.toThrow("Data inválida");
    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(0);
  });

  it("rejects a future entry date before touching membership history", async () => {
    const person = await prisma.person.create({ data: { fullName: `Data futura T22 ${suffix}` } });
    personIds.push(person.id);

    await expect(createMembership(administrator(), {
      personId: person.id,
      ministryId,
      role: "MEMBER",
      startDate: new Date("2027-01-01T00:00:00.000Z"),
    })).rejects.toThrow("futura");
    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(0);
  });

  it("rejects a missing person before touching membership history", async () => {
    await expect(createMembership(administrator(), {
      personId: `missing-person-${suffix}`,
      ministryId,
      role: "MEMBER",
      startDate,
    })).rejects.toThrow("Pessoa não encontrada");
  });

  it("rejects new memberships in an archived Ministry without creating related records", async () => {
    const person = await prisma.person.create({ data: { fullName: `Arquivo T22 ${suffix}` } });
    personIds.push(person.id);
    const archivedMinistry = await prisma.ministry.create({
      data: { name: `Ministério arquivado T22 ${suffix}`, status: "ARCHIVED" },
    });
    ministryIds.push(archivedMinistry.id);

    await expect(createMembership(administrator(), {
      personId: person.id,
      ministryId: archivedMinistry.id,
      role: "MEMBER",
      startDate,
    })).rejects.toThrow("Ministério arquivado");

    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId: archivedMinistry.id } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(0);
  });

  it("allows only one of two concurrent attempts to create the same active membership", async () => {
    const person = await prisma.person.create({ data: { fullName: `Concorrência T22 ${suffix}` } });
    personIds.push(person.id);

    const attempts = await Promise.allSettled([
      createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate }),
      createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId } })).resolves.toBe(1);
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(1);
    const successfulAttempt = attempts.find((attempt) => attempt.status === "fulfilled");
    if (successfulAttempt?.status !== "fulfilled") throw new Error("A successful creation was expected");
    await expect(prisma.auditEvent.count({ where: { targetId: successfulAttempt.value.id, action: "CREATE" } })).resolves.toBe(1);
  });

  it("lists current and historic memberships for the selected Ministry", async () => {
    const ministryForQuery = await prisma.ministry.create({ data: { name: `Ministério escolhido T22 ${suffix}` } });
    ministryIds.push(ministryForQuery.id);
    const currentPerson = await prisma.person.create({ data: { fullName: `Atual consulta T22 ${suffix}` } });
    const historicPerson = await prisma.person.create({ data: { fullName: `Histórica consulta T22 ${suffix}` } });
    const otherPerson = await prisma.person.create({ data: { fullName: `Outro Ministério T22 ${suffix}` } });
    personIds.push(currentPerson.id, historicPerson.id, otherPerson.id);
    const otherMinistry = await prisma.ministry.create({ data: { name: `Ministério consulta T22 ${suffix}` } });
    ministryIds.push(otherMinistry.id);

    await createMembership(administrator(), { personId: currentPerson.id, ministryId: ministryForQuery.id, role: "LEADER", startDate });
    const historic = await createMembership(administrator(), { personId: historicPerson.id, ministryId: ministryForQuery.id, role: "MEMBER", startDate });
    await endMembership(administrator(), historic.id, { endDate });
    await createMembership(administrator(), { personId: otherPerson.id, ministryId: otherMinistry.id, role: "MEMBER", startDate });

    const result = await getMinistryMembershipManagement(administrator(), ministryForQuery.id);

    expect(result?.ministry.id).toBe(ministryForQuery.id);
    expect(result?.currentMemberships.map(({ person }) => person.id)).toEqual([currentPerson.id]);
    expect(result?.currentMemberships[0]).toMatchObject({ role: "LEADER", endDate: null, startDate });
    expect(result?.historicMemberships.map(({ person }) => person.id)).toEqual([historicPerson.id]);
    expect(result?.historicMemberships[0]).toMatchObject({ role: "MEMBER", endDate });
    expect(result?.people.map(({ id }) => id)).toEqual(expect.arrayContaining([currentPerson.id, historicPerson.id, otherPerson.id]));
  });

  it("denies non-administrators and returns no query data for a missing Ministry", async () => {
    await expect(getMinistryMembershipManagement({ id: actorId, role: "SECRETARY" }, ministryId)).rejects.toThrow("Apenas administradores");
    await expect(getMinistryMembershipManagement({ id: actorId, role: "LEADER" }, ministryId)).rejects.toThrow("Apenas administradores");
    await expect(getMinistryMembershipManagement(administrator(), `missing-ministry-${suffix}`)).resolves.toBeNull();
  });

  it("records role changes with an effective timeline date and audit values", async () => {
    const updated = await updateMembershipRole(administrator(), membershipId, { role: "LEADER", effectiveDate: roleDate });
    const ministry = await prisma.ministry.findUniqueOrThrow({ where: { id: ministryId } });

    expect(updated.role).toBe("LEADER");
    await expect(prisma.timelineEvent.findFirst({ where: { personId: updated.personId, title: "Cargo no Ministério alterado" } })).resolves.toMatchObject({
      occurredAt: roleDate,
      description: `${ministry.name} · Cargo: Membro → Líder · Efeito em 15/03/2026`,
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: membershipId, action: "UPDATE_ROLE" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ role: "MEMBER" }),
      after: expect.objectContaining({ role: "LEADER", effectiveDate: roleDate.toISOString() }),
    });
    await expect(prisma.timelineEvent.findFirst({ where: { personId: updated.personId, title: "Cargo no Ministério alterado" } })).resolves.toMatchObject({
      description: expect.stringContaining("Ministério T22"),
    });
  });

  it("ends a membership while preserving the record and person timeline", async () => {
    const ended = await endMembership(administrator(), membershipId, { endDate });
    const ministry = await prisma.ministry.findUniqueOrThrow({ where: { id: ministryId } });

    expect(ended.endDate).toEqual(endDate);
    await expect(prisma.ministryMembership.findUnique({ where: { id: membershipId } })).resolves.toMatchObject({ endDate });
    await expect(prisma.timelineEvent.findFirst({ where: { personId: ended.personId, title: "Vínculo ministerial encerrado" } })).resolves.toMatchObject({
      occurredAt: endDate,
      description: `${ministry.name} · Saída: 30/06/2026`,
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: membershipId, action: "END" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ endDate: null }),
      after: expect.objectContaining({ endDate: endDate.toISOString() }),
    });

    await expect(endMembership(administrator(), membershipId, { endDate: new Date("2026-07-01T00:00:00.000Z") })).rejects.toThrow("já está encerrado");
    await expect(updateMembershipRole(administrator(), membershipId, { role: "MEMBER", effectiveDate: new Date("2026-07-01T00:00:00.000Z") })).rejects.toThrow("encerrado");
    await expect(prisma.ministryMembership.findUnique({ where: { id: membershipId } })).resolves.toMatchObject({ endDate });
  });

  it("rejects role changes with an effective date outside the active membership", async () => {
    const person = await prisma.person.create({ data: { fullName: `Cargo inválido T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });

    await expect(updateMembershipRole(administrator(), membership.id, {
      role: "LEADER",
      effectiveDate: new Date("2026-01-09T00:00:00.000Z"),
    })).rejects.toThrow("anterior ao início");
    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ role: "MEMBER", endDate: null });
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: "UPDATE_ROLE" } })).resolves.toBe(0);
  });

  it("rejects a role outside the two fixed Ministry roles", async () => {
    const person = await prisma.person.create({ data: { fullName: `Cargo fora da lista T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });

    await expect(updateMembershipRole(administrator(), membership.id, {
      role: "VOLUNTEER" as never,
      effectiveDate: roleDate,
    })).rejects.toThrow("Cargo deve ser membro ou líder");

    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ role: "MEMBER" });
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: "UPDATE_ROLE" } })).resolves.toBe(0);
  });

  it("rejects changing the role of a closed membership", async () => {
    const person = await prisma.person.create({ data: { fullName: `Cargo fechado T22 ${suffix}` } });
    personIds.push(person.id);
    const closed = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });
    await endMembership(administrator(), closed.id, { endDate });

    await expect(updateMembershipRole(administrator(), closed.id, { role: "LEADER", effectiveDate: roleDate })).rejects.toThrow("encerrado");
    await expect(prisma.ministryMembership.findUnique({ where: { id: closed.id } })).resolves.toMatchObject({ role: "MEMBER", endDate });
    await expect(prisma.auditEvent.count({ where: { targetId: closed.id, action: "UPDATE_ROLE" } })).resolves.toBe(0);
  });

  it("rejects changing the role in an archived Ministry", async () => {
    const person = await prisma.person.create({ data: { fullName: `Cargo arquivado T22 ${suffix}` } });
    personIds.push(person.id);
    const archivedMinistry = await prisma.ministry.create({ data: { name: `Ministério cargo arquivado T22 ${suffix}` } });
    ministryIds.push(archivedMinistry.id);
    const archived = await createMembership(administrator(), { personId: person.id, ministryId: archivedMinistry.id, role: "MEMBER", startDate });
    await prisma.ministry.update({ where: { id: archivedMinistry.id }, data: { status: "ARCHIVED" } });

    await expect(updateMembershipRole(administrator(), archived.id, { role: "LEADER", effectiveDate: roleDate })).rejects.toThrow("Ministério arquivado");
    await expect(prisma.ministryMembership.findUnique({ where: { id: archived.id } })).resolves.toMatchObject({ role: "MEMBER", endDate: null });
    await expect(prisma.auditEvent.count({ where: { targetId: archived.id, action: "UPDATE_ROLE" } })).resolves.toBe(0);
  });

  it("denies Secretary and Leader membership role changes and ending", async () => {
    const person = await prisma.person.create({ data: { fullName: `Papéis negados T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });

    for (const role of ["SECRETARY", "LEADER"] as const) {
      const actor = { id: actorId, role };
      await expect(updateMembershipRole(actor, membership.id, { role: "LEADER", effectiveDate: roleDate })).rejects.toThrow("Apenas administradores");
      await expect(endMembership(actor, membership.id, { endDate })).rejects.toThrow("Apenas administradores");
    }

    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ role: "MEMBER", endDate: null });
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: { in: ["UPDATE_ROLE", "END"] } } })).resolves.toBe(0);
  });

  it("rejects a future effective date for a role change", async () => {
    const person = await prisma.person.create({ data: { fullName: `Cargo futuro T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });

    await expect(updateMembershipRole(administrator(), membership.id, {
      role: "LEADER",
      effectiveDate: new Date("2027-01-01T00:00:00.000Z"),
    })).rejects.toThrow("futura");

    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ role: "MEMBER", endDate: null });
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: "UPDATE_ROLE" } })).resolves.toBe(0);
  });

  it("rejects an end date before entry or in the future without closing the membership", async () => {
    const person = await prisma.person.create({ data: { fullName: `Saída inválida T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });

    await expect(endMembership(administrator(), membership.id, {
      endDate: new Date("2026-01-09T00:00:00.000Z"),
    })).rejects.toThrow("anterior ao início");
    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ endDate: null });
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: "END" } })).resolves.toBe(0);
  });

  it("rejects a future end date without closing the membership", async () => {
    const person = await prisma.person.create({ data: { fullName: `Saída futura T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });

    await expect(endMembership(administrator(), membership.id, {
      endDate: new Date("2027-01-01T00:00:00.000Z"),
    })).rejects.toThrow("futura");

    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ endDate: null });
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: "END" } })).resolves.toBe(0);
  });

  it("allows ending a current membership after its Ministry is archived", async () => {
    const person = await prisma.person.create({ data: { fullName: `Encerrar arquivado T22 ${suffix}` } });
    personIds.push(person.id);
    const ministry = await prisma.ministry.create({ data: { name: `Ministério fechado T22 ${suffix}` } });
    ministryIds.push(ministry.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId: ministry.id, role: "MEMBER", startDate });
    await prisma.ministry.update({ where: { id: ministry.id }, data: { status: "ARCHIVED" } });

    const ended = await endMembership(administrator(), membership.id, { endDate });

    expect(ended.endDate).toEqual(endDate);
    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ endDate });
    await expect(prisma.timelineEvent.findFirst({ where: { personId: person.id, title: "Vínculo ministerial encerrado" } })).resolves.toMatchObject({
      description: expect.stringContaining(ministry.name),
    });
  });

  it("rolls back the membership and timeline when audit persistence fails", async () => {
    const person = await prisma.person.create({ data: { fullName: `Rollback criação T22 ${suffix}` } });
    personIds.push(person.id);
    const invalidActor = { id: `missing-account-${suffix}`, role: "ADMINISTRATOR" as const };

    await expect(createMembership(invalidActor, {
      personId: person.id,
      ministryId,
      role: "MEMBER",
      startDate,
    })).rejects.toThrow();

    await expect(prisma.ministryMembership.count({ where: { personId: person.id, ministryId } })).resolves.toBe(0);
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(0);
    await expect(prisma.auditEvent.count({ where: { actorId: invalidActor.id } })).resolves.toBe(0);
  });

  it("rolls back a role update and timeline when audit persistence fails", async () => {
    const person = await prisma.person.create({ data: { fullName: `Rollback cargo T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });
    const existingTimelineEvents = await prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } });
    const invalidActor = { id: `missing-account-role-${suffix}`, role: "ADMINISTRATOR" as const };

    await expect(updateMembershipRole(invalidActor, membership.id, { role: "LEADER", effectiveDate: roleDate })).rejects.toThrow();

    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ role: "MEMBER" });
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(existingTimelineEvents);
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: "UPDATE_ROLE" } })).resolves.toBe(0);
  });

  it("rolls back an end date and timeline when audit persistence fails", async () => {
    const person = await prisma.person.create({ data: { fullName: `Rollback saída T22 ${suffix}` } });
    personIds.push(person.id);
    const membership = await createMembership(administrator(), { personId: person.id, ministryId, role: "MEMBER", startDate });
    const existingTimelineEvents = await prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } });
    const invalidActor = { id: `missing-account-end-${suffix}`, role: "ADMINISTRATOR" as const };

    await expect(endMembership(invalidActor, membership.id, { endDate })).rejects.toThrow();

    await expect(prisma.ministryMembership.findUnique({ where: { id: membership.id } })).resolves.toMatchObject({ endDate: null });
    await expect(prisma.timelineEvent.count({ where: { personId: person.id, category: "MINISTRY" } })).resolves.toBe(existingTimelineEvents);
    await expect(prisma.auditEvent.count({ where: { targetId: membership.id, action: "END" } })).resolves.toBe(0);
  });
});
