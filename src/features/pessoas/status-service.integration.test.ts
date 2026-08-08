import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { inactivatePerson, promoteToMember } from "./status-service";

describe("Person status service", () => {
  const personIds: string[] = [];
  const actorId = "t18-status-actor";
  const actor = { id: actorId, role: "SECRETARY" as const };
  const effectiveDate = new Date("2026-07-15T12:00:00.000Z");

  beforeAll(async () => {
    const actorPerson = await prisma.person.create({ data: { fullName: "Autor T18" } });
    personIds.push(actorPerson.id);
    await prisma.account.create({
      data: {
        id: actorId,
        personId: actorPerson.id,
        username: "t18-status-actor",
        email: "t18-status-actor@example.test",
        passwordHash: "test-hash",
        role: actor.role,
      },
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: personIds } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.account.delete({ where: { id: actorId } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("promotes a visitor with required member data and an editable effective date", async () => {
    const visitor = await prisma.person.create({ data: { fullName: "Visitante T18" } });
    personIds.push(visitor.id);

    const member = await promoteToMember(actor, visitor.id, {
      phone: "  (11) 99999-1818  ",
      birthDate: new Date("1995-04-12T00:00:00.000Z"),
      effectiveDate,
    });

    expect(member.status).toBe("MEMBER");
    expect(member.phone).toBe("(11) 99999-1818");
    expect(member.birthDate).toEqual(new Date("1995-04-12T00:00:00.000Z"));
    expect(member.statusChangedAt).toEqual(effectiveDate);
    await expect(prisma.timelineEvent.findFirst({ where: { personId: visitor.id, category: "STATUS" } })).resolves.toMatchObject({
      title: "Pessoa promovida a membro",
      occurredAt: effectiveDate,
    });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: visitor.id, action: "PROMOTE_TO_MEMBER" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ status: "VISITOR" }),
      after: expect.objectContaining({ status: "MEMBER", phone: "(11) 99999-1818" }),
    });
  });

  it("blocks promotion without phone or birth date", async () => {
    const visitor = await prisma.person.create({ data: { fullName: "Visitante incompleto T18" } });
    personIds.push(visitor.id);

    await expect(
      promoteToMember(actor, visitor.id, {
        phone: "",
        birthDate: new Date("1995-04-12T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Telefone é obrigatório");
    await expect(
      promoteToMember(actor, visitor.id, {
        phone: "(11) 99999-0000",
        birthDate: undefined as never,
      }),
    ).rejects.toThrow("Data de nascimento é obrigatória");
  });

  it("inactivates a person without deleting the profile or history", async () => {
    const person = await prisma.person.create({ data: { fullName: "Membro inativado T18", status: "MEMBER" } });
    personIds.push(person.id);
    await prisma.timelineEvent.create({
      data: {
        personId: person.id,
        category: "REGISTRATION",
        title: "Pessoa cadastrada",
        occurredAt: person.createdAt,
      },
    });

    const inactive = await inactivatePerson(actor, person.id, { effectiveDate });

    expect(inactive.id).toBe(person.id);
    expect(inactive.status).toBe("INACTIVE");
    expect(inactive.statusChangedAt).toEqual(effectiveDate);
    await expect(prisma.person.findUnique({ where: { id: person.id } })).resolves.toMatchObject({ status: "INACTIVE" });
    await expect(prisma.timelineEvent.count({ where: { personId: person.id } })).resolves.toBe(2);
    await expect(prisma.auditEvent.findFirst({ where: { targetId: person.id, action: "INACTIVATE" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ status: "MEMBER" }),
      after: expect.objectContaining({ status: "INACTIVE" }),
    });
  });
});
