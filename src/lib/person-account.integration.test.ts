import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

describe("Person and Account persistence", () => {
  const personIds: string[] = [];

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: "Pessoa de integração T06" },
    });
    personIds.push(person.id);
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("creates a visitor with the default status and no persisted age", async () => {
    const person = await prisma.person.findUniqueOrThrow({
      where: { id: personIds[0] },
    });

    expect(person.status).toBe("VISITOR");
    expect(person.birthDate).toBeNull();
    expect("age" in person).toBe(false);
  });

  it("supports account roles and active status for one linked person", async () => {
    const account = await prisma.account.create({
      data: {
        personId: personIds[0],
        username: "integracao-t06",
        email: "integracao-t06@example.test",
        passwordHash: "test-hash",
        role: "ADMINISTRATOR",
      },
      include: { person: true },
    });

    expect(account.role).toBe("ADMINISTRATOR");
    expect(account.status).toBe("ACTIVE");
    expect(account.person.id).toBe(personIds[0]);
  });

  it("enforces unique username, email and person account links", async () => {
    const secondPerson = await prisma.person.create({
      data: { fullName: "Segunda pessoa de integração T06" },
    });
    personIds.push(secondPerson.id);

    await prisma.account.create({
      data: {
        personId: secondPerson.id,
        username: "segundo-usuario-t06",
        email: "segundo-t06@example.test",
        passwordHash: "test-hash",
      },
    });

    await expect(
      prisma.account.create({
        data: {
          personId: secondPerson.id,
          username: "outro-usuario-t06",
          email: "integracao-t06@example.test",
          passwordHash: "test-hash",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(
      prisma.account.create({
        data: {
          personId: secondPerson.id,
          username: "terceiro-usuario-t06",
          email: "segundo-t06@example.test",
          passwordHash: "test-hash",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(
      prisma.account.create({
        data: {
          personId: secondPerson.id,
          username: "quarto-usuario-t06",
          email: "terceiro-t06@example.test",
          passwordHash: "test-hash",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
