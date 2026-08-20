import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { listAuditEvents } from "./audit-query";

describe("audit query", () => {
  const suffix = Date.now().toString();
  let adminId: string;
  let secretaryId: string;
  let targetId: string;

  beforeAll(async () => {
    const admin = await prisma.account.create({
      data: {
        username: `t33-admin-${suffix}`,
        email: `t33-admin-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "ADMINISTRATOR",
        person: { create: { fullName: `Administrador T33 ${suffix}` } },
      },
    });
    const secretary = await prisma.account.create({
      data: {
        username: `t33-secretary-${suffix}`,
        email: `t33-secretary-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "SECRETARY",
        person: { create: { fullName: `Secretaria T33 ${suffix}` } },
      },
    });
    const target = await prisma.person.create({ data: { fullName: `Pessoa auditada T33 ${suffix}` } });
    adminId = admin.id;
    secretaryId = secretary.id;
    targetId = target.id;
    await prisma.auditEvent.create({
      data: {
        actorId: adminId,
        targetType: "Person",
        targetId,
        action: "STATUS_CHANGE",
        before: { status: "VISITOR" },
        after: { status: "MEMBER" },
        reason: "Cadastro confirmado",
      },
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: [adminId, secretaryId] } } });
    await prisma.account.deleteMany({ where: { id: { in: [adminId, secretaryId] } } });
    await prisma.person.deleteMany({ where: { id: targetId } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: "Administrador T33" } } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: "Secretaria T33" } } });
  });

  it("returns target, actor, action, before, after and reason for administrators", async () => {
    const events = await listAuditEvents({ id: adminId, role: "ADMINISTRATOR" });
    const event = events.find(({ targetId: eventTargetId }) => eventTargetId === targetId);

    expect(event).toMatchObject({
      actorId: adminId,
      targetType: "Person",
      targetId,
      action: "STATUS_CHANGE",
      before: { status: "VISITOR" },
      after: { status: "MEMBER" },
      reason: "Cadastro confirmado",
    });
    expect(event?.actor?.person.fullName).toBe(`Administrador T33 ${suffix}`);
    expect(event?.createdAt).toBeInstanceOf(Date);
  });

  it("denies audit queries for non-administrators", async () => {
    await expect(listAuditEvents({ id: secretaryId, role: "SECRETARY" })).rejects.toThrow("Apenas administradores");
  });
});
