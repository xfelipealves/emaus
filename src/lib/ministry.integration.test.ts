import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

describe("Ministry persistence", () => {
  const personIds: string[] = [];
  const accountIds: string[] = [];
  const ministryIds: string[] = [];

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: "Pessoa de integração T07" },
    });
    personIds.push(person.id);

    const account = await prisma.account.create({
      data: {
        personId: person.id,
        username: "integracao-t07",
        email: "integracao-t07@example.test",
        passwordHash: "test-hash",
        role: "LEADER",
      },
    });
    accountIds.push(account.id);

    const ministry = await prisma.ministry.create({
      data: { name: "Ministério de integração T07" },
    });
    ministryIds.push(ministry.id);
  });

  afterAll(async () => {
    await prisma.accountMinistryAccess.deleteMany({
      where: { accountId: { in: accountIds } },
    });
    await prisma.ministryMembership.deleteMany({
      where: { personId: { in: personIds } },
    });
    await prisma.ministry.deleteMany({ where: { id: { in: ministryIds } } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("stores membership role, start date and optional end date", async () => {
    const membership = await prisma.ministryMembership.create({
      data: {
        personId: personIds[0],
        ministryId: ministryIds[0],
        role: "LEADER",
        startDate: new Date("2026-01-10T00:00:00.000Z"),
        endDate: new Date("2026-06-30T00:00:00.000Z"),
      },
    });

    expect(membership.role).toBe("LEADER");
    expect(membership.startDate).toEqual(new Date("2026-01-10T00:00:00.000Z"));
    expect(membership.endDate).toEqual(new Date("2026-06-30T00:00:00.000Z"));
  });

  it("keeps account ministry scope independent from membership role", async () => {
    const access = await prisma.accountMinistryAccess.create({
      data: { accountId: accountIds[0], ministryId: ministryIds[0] },
      include: { account: true, ministry: true },
    });

    expect(access.account.role).toBe("LEADER");
    expect(access.ministry.id).toBe(ministryIds[0]);
    expect(access.revokedAt).toBeNull();
  });

  it("represents an archived ministry while preserving its history", async () => {
    const archived = await prisma.ministry.update({
      where: { id: ministryIds[0] },
      data: { status: "ARCHIVED" },
      include: { memberships: true },
    });

    expect(archived.status).toBe("ARCHIVED");
    expect(archived.memberships).toHaveLength(1);
  });
});
