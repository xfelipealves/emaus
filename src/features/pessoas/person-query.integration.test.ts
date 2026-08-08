import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "../auth/password";
import { prisma } from "../../lib/prisma";
import { searchPeople } from "./person-query";

describe("people query", () => {
  const username = "t19-people-query";
  const personIds: string[] = [];
  let accountId: string;

  beforeAll(async () => {
    const accountPerson = await prisma.person.create({ data: { fullName: "Administrador T19" } });
    personIds.push(accountPerson.id);
    const account = await prisma.account.create({
      data: {
        personId: accountPerson.id,
        username,
        email: `${username}@example.test`,
        passwordHash: await hashPassword("senha-t19"),
        role: "ADMINISTRATOR",
      },
    });
    accountId = account.id;

    const people = await Promise.all([
      prisma.person.create({
        data: { fullName: "Ana Visitante T19", status: "VISITOR" },
      }),
      prisma.person.create({
        data: { fullName: "Bruno Membro T19", status: "MEMBER", birthDate: new Date("1990-08-10T00:00:00.000Z") },
      }),
      prisma.person.create({
        data: { fullName: "Carla Inativa T19", status: "INACTIVE", birthDate: new Date("1980-01-01T00:00:00.000Z") },
      }),
    ]);
    personIds.push(...people.map((person) => person.id));
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: personIds } } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.account.deleteMany({ where: { id: accountId } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("returns all statuses ordered by name and calculates age only for dated people", async () => {
    const people = await searchPeople(
      { id: accountId, role: "ADMINISTRATOR" },
      { now: new Date("2026-08-08T12:00:00.000Z") },
    );

    expect(people.map((person) => person.fullName)).toEqual(expect.arrayContaining([
      "Administrador T19",
      "Ana Visitante T19",
      "Bruno Membro T19",
      "Carla Inativa T19",
    ]));
    expect(people.find((person) => person.fullName === "Ana Visitante T19")?.age).toBeNull();
    expect(people.find((person) => person.fullName === "Bruno Membro T19")?.age).toBe(35);
  });

  it("filters by visitor, member and inactive status", async () => {
    const visitors = await searchPeople({ id: accountId, role: "ADMINISTRATOR" }, { status: "visitor" });
    const members = await searchPeople({ id: accountId, role: "ADMINISTRATOR" }, { status: "member" });
    const inactive = await searchPeople({ id: accountId, role: "ADMINISTRATOR" }, { status: "inactive" });
    expect(visitors.find((person) => person.fullName === "Ana Visitante T19")?.status).toBe("VISITOR");
    expect(visitors.every((person) => person.status === "VISITOR")).toBe(true);
    expect(members.find((person) => person.fullName === "Bruno Membro T19")?.status).toBe("MEMBER");
    expect(members.every((person) => person.status === "MEMBER")).toBe(true);
    expect(inactive.find((person) => person.fullName === "Carla Inativa T19")?.status).toBe("INACTIVE");
    expect(inactive.every((person) => person.status === "INACTIVE")).toBe(true);
  });

  it("searches names case-insensitively and partially", async () => {
    await expect(searchPeople({ id: accountId, role: "ADMINISTRATOR" }, { search: "visitante" }))
      .resolves.toMatchObject([{ fullName: "Ana Visitante T19" }]);
  });
});
