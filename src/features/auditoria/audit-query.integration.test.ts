import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { listAuditEvents } from "./audit-query";

describe("audit query", () => {
  const suffix = Date.now().toString();
  let adminId: string;
  let secretaryId: string;
  let targetId: string;
  let attendanceId: string;
  let categoryId: string;
  let meetingId: string;
  let meetingTitle: string;

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
    const category = await prisma.category.create({ data: { name: `Categoria auditoria T33 ${suffix}` } });
    categoryId = category.id;
    meetingTitle = `Encontro auditoria T33 ${suffix}`;
    const meeting = await prisma.meeting.create({
      data: {
        categoryId,
        title: meetingTitle,
        scheduledAt: new Date("2026-09-27T22:00:00.000Z"),
        status: "SCHEDULED",
      },
    });
    meetingId = meeting.id;
    const attendance = await prisma.attendance.create({
      data: { meetingId, personId: targetId, status: "PRESENT" },
    });
    attendanceId = attendance.id;
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
    await prisma.auditEvent.create({
      data: {
        actorId: adminId,
        targetType: "Attendance",
        targetId: attendanceId,
        action: "UPDATE",
        before: { status: "NOT_CONFIRMED" },
        after: { status: "PRESENT" },
      },
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: [adminId, secretaryId] } } });
    await prisma.attendance.deleteMany({ where: { id: attendanceId } });
    await prisma.meeting.deleteMany({ where: { id: meetingId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
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

  it("resolves attendance audit ids to the person and meeting while preserving before and after", async () => {
    const events = await listAuditEvents({ id: adminId, role: "ADMINISTRATOR" });
    const event = events.find(({ targetType, targetId: eventTargetId }) => targetType === "Attendance" && eventTargetId === attendanceId);

    expect(event).toMatchObject({
      targetType: "Attendance",
      targetId: attendanceId,
      actor: { person: { fullName: `Administrador T33 ${suffix}` } },
      before: { status: "NOT_CONFIRMED" },
      after: { status: "PRESENT" },
      attendanceContext: {
        personName: `Pessoa auditada T33 ${suffix}`,
        meetingTitle,
      },
    });
  });

  it("denies audit queries for non-administrators", async () => {
    await expect(listAuditEvents({ id: secretaryId, role: "SECRETARY" })).rejects.toThrow("Apenas administradores");
  });
});
