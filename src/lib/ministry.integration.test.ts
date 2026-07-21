import {
  AccountRole,
  AccountStatus,
  MinistryMembershipRole,
  MinistryStatus,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

describe("Ministry schema", () => {
  beforeEach(async () => {
    await prisma.accountMinistryAccess.deleteMany();
    await prisma.ministryMembership.deleteMany();
    await prisma.account.deleteMany();
    await prisma.ministry.deleteMany();
    await prisma.person.deleteMany();
  });

  afterAll(async () => {
    await prisma.accountMinistryAccess.deleteMany();
    await prisma.ministryMembership.deleteMany();
    await prisma.account.deleteMany();
    await prisma.ministry.deleteMany();
    await prisma.person.deleteMany();
    await prisma.$disconnect();
  });

  it("stores membership role, start date and optional end date", async () => {
    const person = await prisma.person.create({ data: { fullName: "Pessoa do Ministério" } });
    const ministry = await prisma.ministry.create({ data: { name: "Recepção" } });
    const startDate = new Date("2026-01-10T00:00:00.000Z");
    const endDate = new Date("2026-06-10T00:00:00.000Z");

    const membership = await prisma.ministryMembership.create({
      data: {
        personId: person.id,
        ministryId: ministry.id,
        role: MinistryMembershipRole.LEADER,
        startDate,
        endDate,
      },
    });

    expect(membership.role).toBe(MinistryMembershipRole.LEADER);
    expect(membership.startDate).toEqual(startDate);
    expect(membership.endDate).toEqual(endDate);
  });

  it("keeps leader account scope independent from membership role", async () => {
    const person = await prisma.person.create({ data: { fullName: "Líder" } });
    const account = await prisma.account.create({
      data: {
        username: "lider",
        email: "lider@example.test",
        passwordHash: "argon2-hash",
        role: AccountRole.LEADER,
        status: AccountStatus.ACTIVE,
        personId: person.id,
      },
    });
    const ministry = await prisma.ministry.create({ data: { name: "Música" } });
    const membership = await prisma.ministryMembership.create({
      data: {
        personId: person.id,
        ministryId: ministry.id,
        role: MinistryMembershipRole.MEMBER,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const access = await prisma.accountMinistryAccess.create({
      data: { accountId: account.id, ministryId: ministry.id },
    });

    expect(membership.role).toBe(MinistryMembershipRole.MEMBER);
    expect(access.accountId).toBe(account.id);
    expect(access.ministryId).toBe(ministry.id);
  });

  it("represents an archived ministry while preserving its memberships", async () => {
    const person = await prisma.person.create({ data: { fullName: "Participante" } });
    const ministry = await prisma.ministry.create({
      data: { name: "Ministério arquivado", status: MinistryStatus.ARCHIVED },
    });
    const membership = await prisma.ministryMembership.create({
      data: {
        personId: person.id,
        ministryId: ministry.id,
        role: MinistryMembershipRole.MEMBER,
        startDate: new Date("2025-01-01T00:00:00.000Z"),
        endDate: new Date("2025-12-31T00:00:00.000Z"),
      },
    });

    const archivedMinistry = await prisma.ministry.findUniqueOrThrow({
      where: { id: ministry.id },
      include: { memberships: true },
    });

    expect(archivedMinistry.status).toBe(MinistryStatus.ARCHIVED);
    expect(archivedMinistry.memberships.map(({ id }) => id)).toContain(membership.id);
  });
});
