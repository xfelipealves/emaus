import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { registerPerson } from "./person-actions";

describe("Person registration actions", () => {
  const personIds: string[] = [];
  const actor = { id: "t17-registration-actor", role: "SECRETARY" as const };

  beforeAll(async () => {
    const actorPerson = await prisma.person.create({ data: { fullName: "Autor T17" } });
    personIds.push(actorPerson.id);
    await prisma.account.create({
      data: {
        id: actor.id,
        personId: actorPerson.id,
        username: "t17-registration-actor",
        email: "t17-registration-actor@example.test",
        passwordHash: "test-hash",
        role: actor.role,
      },
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: personIds } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.account.delete({ where: { id: actor.id } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("registers a visitor with only the full name and visitor status", async () => {
    const person = await registerPerson(actor, { type: "visitor", fullName: "  Visitante T17  " });
    personIds.push(person.id);

    expect(person.fullName).toBe("Visitante T17");
    expect(person.status).toBe("VISITOR");
    expect(person.phone).toBeNull();
    expect(person.birthDate).toBeNull();
  });

  it("registers a member with phone and birth date", async () => {
    const birthDate = new Date("1995-04-12T00:00:00.000Z");
    const person = await registerPerson(actor, {
      type: "member",
      fullName: "Membro T17",
      phone: "(11) 99999-0000",
      birthDate,
    });
    personIds.push(person.id);

    expect(person.status).toBe("MEMBER");
    expect(person.phone).toBe("(11) 99999-0000");
    expect(person.birthDate).toEqual(birthDate);
  });

  it("blocks a member without phone or birth date", async () => {
    await expect(registerPerson(actor, { type: "member", fullName: "Membro incompleto" })).rejects.toThrow(
      "Telefone é obrigatório para membros.",
    );
  });
});
