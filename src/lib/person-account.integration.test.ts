import { AccountRole, AccountStatus, PersonStatus, PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

describe("Person and Account schema", () => {
  beforeEach(async () => {
    await prisma.account.deleteMany();
    await prisma.person.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("supports visitor, member and inactive person statuses", async () => {
    const people = await prisma.$transaction([
      prisma.person.create({ data: { fullName: "Visitante", status: PersonStatus.VISITOR } }),
      prisma.person.create({ data: { fullName: "Membro", status: PersonStatus.MEMBER } }),
      prisma.person.create({ data: { fullName: "Inativo", status: PersonStatus.INACTIVE } }),
    ]);

    expect(people.map((person) => person.status)).toEqual([
      PersonStatus.VISITOR,
      PersonStatus.MEMBER,
      PersonStatus.INACTIVE,
    ]);
  });

  it("enforces unique username, email and person link for accounts", async () => {
    const firstPerson = await prisma.person.create({ data: { fullName: "Primeira Pessoa" } });
    const secondPerson = await prisma.person.create({ data: { fullName: "Segunda Pessoa" } });
    const accountData = {
      username: "admin",
      email: "admin@example.test",
      passwordHash: "argon2-hash",
      role: AccountRole.ADMIN,
      status: AccountStatus.ACTIVE,
      personId: firstPerson.id,
    };

    const account = await prisma.account.create({ data: accountData });

    expect(account.personId).toBe(firstPerson.id);
    expect(account.role).toBe(AccountRole.ADMIN);
    expect(account.status).toBe(AccountStatus.ACTIVE);

    await expect(
      prisma.account.create({ data: { ...accountData, personId: secondPerson.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.account.create({ data: { ...accountData, email: "other@example.test", personId: secondPerson.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.account.create({ data: { ...accountData, username: "other-admin", personId: secondPerson.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("does not persist an age column", async () => {
    const ageColumn = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Person'
        AND column_name = 'age'
    `;

    expect(ageColumn[0]?.count).toBe(BigInt(0));
  });
});
