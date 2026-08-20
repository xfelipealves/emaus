import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { grantMinistryAccess, revokeMinistryAccess } from "./access-scope-service";

describe("leader ministry access scopes", () => {
  const suffix = Date.now().toString();
  let actorId: string;
  let leaderId: string;
  let secretaryId: string;
  let ministryId: string;
  let accessId: string;
  const personIds: string[] = [];
  const accountIds: string[] = [];

  beforeAll(async () => {
    const actorPerson = await prisma.person.create({ data: { fullName: `Autor T23 ${suffix}` } });
    const leaderPerson = await prisma.person.create({ data: { fullName: `Líder T23 ${suffix}` } });
    const secretaryPerson = await prisma.person.create({ data: { fullName: `Secretaria T23 ${suffix}` } });
    personIds.push(actorPerson.id, leaderPerson.id, secretaryPerson.id);

    const accounts = await Promise.all([
      prisma.account.create({
        data: { personId: actorPerson.id, username: `admin-t23-${suffix}`, email: `admin-t23-${suffix}@example.test`, passwordHash: "test-hash", role: "ADMINISTRATOR" },
      }),
      prisma.account.create({
        data: { personId: leaderPerson.id, username: `leader-t23-${suffix}`, email: `leader-t23-${suffix}@example.test`, passwordHash: "test-hash", role: "LEADER" },
      }),
      prisma.account.create({
        data: { personId: secretaryPerson.id, username: `secretary-t23-${suffix}`, email: `secretary-t23-${suffix}@example.test`, passwordHash: "test-hash", role: "SECRETARY" },
      }),
    ]);
    actorId = accounts[0].id;
    leaderId = accounts[1].id;
    secretaryId = accounts[2].id;
    accountIds.push(...accounts.map((account) => account.id));
    const ministry = await prisma.ministry.create({ data: { name: `Ministério T23 ${suffix}` } });
    ministryId = ministry.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.ministry.delete({ where: { id: ministryId } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.$disconnect();
  });

  it("grants a scope only to a leader and keeps it independent from memberships", async () => {
    const access = await grantMinistryAccess(
      { id: actorId, role: "ADMINISTRATOR" },
      { accountId: leaderId, ministryId },
    );
    accessId = access.id;

    expect(access.accountId).toBe(leaderId);
    expect(access.ministryId).toBe(ministryId);
    expect(access.revokedAt).toBeNull();
    await expect(prisma.ministryMembership.count({ where: { ministryId } })).resolves.toBe(0);
  });

  it("revokes access without deleting the grant and records before and after values", async () => {
    const revoked = await revokeMinistryAccess(
      { id: actorId, role: "ADMINISTRATOR" },
      { accountId: leaderId, ministryId },
    );
    expect(revoked.id).toBe(accessId);
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    await expect(prisma.accountMinistryAccess.findUnique({ where: { id: accessId } })).resolves.toMatchObject({ id: accessId });
    await expect(prisma.auditEvent.findFirst({ where: { targetId: accessId, action: "REVOKE" } })).resolves.toMatchObject({
      actorId,
      before: expect.objectContaining({ revokedAt: null }),
      after: expect.objectContaining({ revokedAt: revoked.revokedAt?.toISOString() }),
    });
  });

  it("re-grants a revoked scope and restores future access on the same record", async () => {
    const granted = await grantMinistryAccess(
      { id: actorId, role: "ADMINISTRATOR" },
      { accountId: leaderId, ministryId },
    );
    expect(granted.id).toBe(accessId);
    expect(granted.revokedAt).toBeNull();
  });

  it("denies scope administration to non-administrators", async () => {
    await expect(
      grantMinistryAccess(
        { id: secretaryId, role: "SECRETARY" },
        { accountId: leaderId, ministryId },
      ),
    ).rejects.toThrow("Apenas administradores");
  });
});
