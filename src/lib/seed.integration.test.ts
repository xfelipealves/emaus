import { AccountRole, AccountStatus, PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { seed } from "../../prisma/seed";

const prisma = new PrismaClient();

describe("development seed", () => {
  beforeEach(async () => {
    await prisma.account.deleteMany();
    await prisma.person.deleteMany();
  });

  afterAll(async () => {
    await prisma.account.deleteMany();
    await prisma.person.deleteMany();
    await prisma.$disconnect();
  });

  it("creates one person linked to an active administrator account", async () => {
    await seed(prisma);

    const accounts = await prisma.account.findMany({ include: { person: true } });

    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      role: AccountRole.ADMIN,
      status: AccountStatus.ACTIVE,
      person: { fullName: "Administrador Emaús" },
    });
    expect(accounts[0]?.passwordHash).toBeTruthy();
  });
});
