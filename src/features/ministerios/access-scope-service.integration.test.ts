import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { inactivatePerson, promoteToMember } from "../pessoas/status-service";
import { grantMinistryAccess, listLeaderScopeConfiguration, revokeMinistryAccess } from "./access-scope-service";

describe("leader ministry access scopes", () => {
  const suffix = Date.now().toString();
  let actorId: string;
  let leaderId: string;
  let secretaryId: string;
  let ministryId: string;
  let archivedMinistryId: string;
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
    const archivedMinistry = await prisma.ministry.create({ data: { name: `Ministério arquivado T23 ${suffix}`, status: "ARCHIVED" } });
    archivedMinistryId = archivedMinistry.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { OR: [{ actorId: { in: accountIds } }, { targetId: { in: personIds } }] } });
    await prisma.timelineEvent.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.ministryMembership.deleteMany({ where: { ministryId: { in: [ministryId, archivedMinistryId] } } });
    await prisma.ministry.deleteMany({ where: { id: { in: [ministryId, archivedMinistryId] } } });
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

    const duplicate = await grantMinistryAccess(
      { id: actorId, role: "ADMINISTRATOR" },
      { accountId: leaderId, ministryId },
    );
    expect(duplicate.id).toBe(access.id);
    await expect(prisma.auditEvent.count({ where: { targetId: access.id, action: "GRANT" } })).resolves.toBe(1);
    await expect(prisma.auditEvent.findFirst({ where: { targetId: access.id, action: "GRANT" } })).resolves.toMatchObject({
      actorId,
      targetType: "AccountMinistryAccess",
      after: expect.objectContaining({
        accountId: leaderId,
        ministryId,
        grantedAt: access.grantedAt.toISOString(),
        revokedAt: null,
      }),
    });
    const grantEvent = await prisma.auditEvent.findFirst({ where: { targetId: access.id, action: "GRANT" } });
    expect(grantEvent?.createdAt).toBeInstanceOf(Date);
    expect(grantEvent?.createdAt.getTime()).toBeGreaterThanOrEqual(access.createdAt.getTime());
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
      targetType: "AccountMinistryAccess",
      before: expect.objectContaining({ revokedAt: null }),
      after: expect.objectContaining({ revokedAt: revoked.revokedAt?.toISOString() }),
    });

    await expect(
      revokeMinistryAccess({ id: actorId, role: "ADMINISTRATOR" }, { accountId: leaderId, ministryId }),
    ).rejects.toThrow("já foi revogado");
    await expect(prisma.accountMinistryAccess.findUnique({ where: { id: accessId } })).resolves.toMatchObject({ revokedAt: revoked.revokedAt });
    await expect(prisma.auditEvent.count({ where: { targetId: accessId, action: "REVOKE" } })).resolves.toBe(1);
  });

  it("re-grants a revoked scope and restores future access on the same record", async () => {
    const previousGrantDate = new Date("2000-01-01T00:00:00.000Z");
    await prisma.accountMinistryAccess.update({ where: { id: accessId }, data: { grantedAt: previousGrantDate } });
    const granted = await grantMinistryAccess(
      { id: actorId, role: "ADMINISTRATOR" },
      { accountId: leaderId, ministryId },
    );
    expect(granted.id).toBe(accessId);
    expect(granted.grantedAt.getTime()).toBeGreaterThan(previousGrantDate.getTime());
    expect(granted.revokedAt).toBeNull();
    await expect(prisma.auditEvent.count({ where: { targetId: accessId, action: "GRANT" } })).resolves.toBe(2);
    const regrantEvent = await prisma.auditEvent.findFirst({
      where: { targetId: accessId, action: "GRANT" },
      orderBy: { createdAt: "desc" },
    });
    expect(regrantEvent).toMatchObject({
      actorId,
      targetType: "AccountMinistryAccess",
      before: expect.objectContaining({ grantedAt: previousGrantDate.toISOString(), revokedAt: expect.any(String) }),
      after: expect.objectContaining({
        accountId: leaderId,
        ministryId,
        grantedAt: granted.grantedAt.toISOString(),
        revokedAt: null,
      }),
    });
    expect(regrantEvent?.createdAt).toBeInstanceOf(Date);
  });

  it("shows administrators only current leader grants, excluding revoked history", async () => {
    await prisma.accountMinistryAccess.create({
      data: { accountId: leaderId, ministryId: archivedMinistryId, revokedAt: new Date() },
    });
    const settings = await listLeaderScopeConfiguration({ id: actorId, role: "ADMINISTRATOR" });

    expect(settings.find((setting) => setting.id === leaderId)).toMatchObject({
      id: leaderId,
      username: `leader-t23-${suffix}`,
      status: "ACTIVE",
      person: { fullName: `Líder T23 ${suffix}` },
      ministryAccess: [{ ministryId, ministry: { name: `Ministério T23 ${suffix}`, status: "ACTIVE" } }],
    });
    expect(settings.some((setting) => setting.ministryAccess.some((access) => access.ministryId === archivedMinistryId))).toBe(false);
    await expect(listLeaderScopeConfiguration({ id: secretaryId, role: "SECRETARY" })).rejects.toThrow("Apenas administradores");
  });

  it("denies scope administration to non-administrators", async () => {
    await expect(
      grantMinistryAccess(
        { id: secretaryId, role: "SECRETARY" },
        { accountId: leaderId, ministryId },
      ),
    ).rejects.toThrow("Apenas administradores");
    await expect(
      revokeMinistryAccess(
        { id: secretaryId, role: "SECRETARY" },
        { accountId: leaderId, ministryId },
      ),
    ).rejects.toThrow("Apenas administradores");
    await expect(prisma.accountMinistryAccess.findUnique({ where: { id: accessId } })).resolves.toMatchObject({ revokedAt: null });
  });

  it("rejects non-leader targets, archived ministries and missing ministries without partial access", async () => {
    const admin = { id: actorId, role: "ADMINISTRATOR" as const };
    await expect(grantMinistryAccess(admin, { accountId: secretaryId, ministryId })).rejects.toThrow("só podem ser concedidos a líderes");
    await expect(grantMinistryAccess(admin, { accountId: leaderId, ministryId: archivedMinistryId })).rejects.toThrow("Ministério arquivado");
    await expect(grantMinistryAccess(admin, { accountId: leaderId, ministryId: "ministry-does-not-exist" })).rejects.toThrow("Ministério não encontrado");
    const missingAccountId = "account-does-not-exist-t23";
    await expect(grantMinistryAccess(admin, { accountId: missingAccountId, ministryId })).rejects.toThrow("Conta não encontrada");

    await expect(prisma.accountMinistryAccess.count({ where: { accountId: secretaryId } })).resolves.toBe(0);
    await expect(prisma.accountMinistryAccess.count({ where: { accountId: leaderId, ministryId: archivedMinistryId, revokedAt: null } })).resolves.toBe(0);
    await expect(prisma.accountMinistryAccess.count({ where: { accountId: leaderId, ministryId: "ministry-does-not-exist" } })).resolves.toBe(0);
    await expect(prisma.accountMinistryAccess.count({ where: { accountId: missingAccountId } })).resolves.toBe(0);
  });

  it("denies a scoped Leader generic Person status changes without persistence", async () => {
    const admin = { id: actorId, role: "ADMINISTRATOR" as const };
    const leader = { id: leaderId, role: "LEADER" as const };
    const access = await grantMinistryAccess(admin, { accountId: leaderId, ministryId });
    expect(access.revokedAt).toBeNull();

    const visitor = await prisma.person.create({
      data: {
        fullName: `Visitante protegido T23 ${suffix}`,
        phone: "Telefone existente",
        birthDate: new Date("1995-04-12T00:00:00.000Z"),
      },
    });
    const member = await prisma.person.create({
      data: {
        fullName: `Membro protegido T23 ${suffix}`,
        status: "MEMBER",
        memberships: { create: { ministryId, role: "MEMBER", startDate: new Date("2026-01-01T00:00:00.000Z") } },
      },
    });
    personIds.push(visitor.id, member.id);
    const visitorStatusChangedAt = visitor.statusChangedAt;
    const memberStatusChangedAt = member.statusChangedAt;

    await expect(
      promoteToMember(leader, visitor.id, {
        phone: "(11) 99999-2323",
        birthDate: new Date("1995-04-12T00:00:00.000Z"),
        effectiveDate: new Date("2026-07-15T12:00:00.000Z"),
      }),
    ).rejects.toThrow("Você não tem permissão para gerenciar Pessoas.");
    await expect(
      inactivatePerson(leader, member.id, { effectiveDate: new Date("2026-07-15T12:00:00.000Z") }),
    ).rejects.toThrow("Você não tem permissão para gerenciar Pessoas.");

    await expect(prisma.person.findUnique({ where: { id: visitor.id } })).resolves.toMatchObject({
      status: "VISITOR",
      phone: "Telefone existente",
      birthDate: new Date("1995-04-12T00:00:00.000Z"),
      statusChangedAt: visitorStatusChangedAt,
    });
    await expect(prisma.person.findUnique({ where: { id: member.id } })).resolves.toMatchObject({
      status: "MEMBER",
      statusChangedAt: memberStatusChangedAt,
    });
    await expect(prisma.timelineEvent.count({ where: { personId: { in: [visitor.id, member.id] } } })).resolves.toBe(0);
    await expect(prisma.auditEvent.count({ where: { actorId: leaderId, targetId: { in: [visitor.id, member.id] } } })).resolves.toBe(0);
  });
});
