import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { listAuditEvents } from "./audit-query";

describe("audit query", () => {
  const suffix = Date.now().toString();
  let adminId: string;
  let secretaryId: string;
  let targetId: string;
  let attendanceId: string;
  let attendanceTargetId: string;
  let missingAttendanceTargetId: string;
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
    const category = await prisma.category.create({ data: { name: `Categoria T33 ${suffix}` } });
    const meeting = await prisma.meeting.create({
      data: {
        categoryId: category.id,
        title: `Encontro auditado T33 ${suffix}`,
        scheduledAt: new Date("2026-09-10T22:00:00.000Z"),
        status: "SCHEDULED",
      },
    });
    const attendance = await prisma.attendance.create({ data: { meetingId: meeting.id, personId: target.id, status: "PRESENT" } });
    adminId = admin.id;
    secretaryId = secretary.id;
    targetId = target.id;
    attendanceId = attendance.id;
    attendanceTargetId = attendance.id;
    missingAttendanceTargetId = `missing-attendance-${suffix}`;
    categoryId = category.id;
    meetingId = meeting.id;
    meetingTitle = meeting.title;
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
    await prisma.auditEvent.createMany({
      data: [
        {
          actorId: adminId,
          targetType: "Attendance",
          targetId: attendanceId,
          action: "UPDATE",
          before: { status: "NOT_CONFIRMED" },
          after: { status: "PRESENT" },
        },
        {
          actorId: adminId,
          targetType: "Attendance",
          targetId: missingAttendanceTargetId,
          action: "UPDATE",
          before: { status: "PRESENT" },
          after: { status: "ABSENT" },
        },
      ],
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
    expect(event).not.toHaveProperty("attendanceContext");
  });

  it("resolves attendance target to the related person and meeting in one query result", async () => {
    const events = await listAuditEvents({ id: adminId, role: "ADMINISTRATOR" });
    const event = events.find(({ targetId: eventTargetId }) => eventTargetId === attendanceId);

    expect(event).toMatchObject({
      targetType: "Attendance",
      targetId: attendanceTargetId,
      attendanceContext: {
        personName: `Pessoa auditada T33 ${suffix}`,
        meetingTitle,
      },
      before: { status: "NOT_CONFIRMED" },
      after: { status: "PRESENT" },
    });
  });

  it("keeps attendance events with a missing target and returns null context", async () => {
    const events = await listAuditEvents({ id: adminId, role: "ADMINISTRATOR" });
    const event = events.find(({ targetId: eventTargetId }) => eventTargetId === missingAttendanceTargetId);

    expect(event).toMatchObject({ targetType: "Attendance", targetId: missingAttendanceTargetId, attendanceContext: null });
    expect(event).toMatchObject({ before: { status: "PRESENT" }, after: { status: "ABSENT" } });
  });

  it("denies audit queries for non-administrators", async () => {
    await expect(listAuditEvents({ id: secretaryId, role: "SECRETARY" })).rejects.toThrow("Apenas administradores");
  });
});
