import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  DEVELOPMENT_PASSWORD_HASH,
  seed,
  seedPrisma,
} from "../../prisma/seed";

describe("development seed", () => {
  beforeAll(async () => {
    await seed();
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { username: "admin" } });
    await seedPrisma.$disconnect();
    await prisma.$disconnect();
  });

  it("creates an administrator account linked to a Person", async () => {
    const account = await prisma.account.findUniqueOrThrow({
      where: { username: "admin" },
      include: { person: true },
    });

    expect(account.role).toBe("ADMINISTRATOR");
    expect(account.status).toBe("ACTIVE");
    expect(account.person.fullName).toBe("Administrador de Desenvolvimento");
    expect(account.passwordHash).toBe(DEVELOPMENT_PASSWORD_HASH);
  });
});
