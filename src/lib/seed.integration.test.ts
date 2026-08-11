import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  DEMO_PASSWORD,
  DEMO_SCENARIO_IDS,
  DEVELOPMENT_PASSWORD_HASH,
  seed,
  seedPrisma,
} from "../../prisma/seed";

const demoAccountIds = Object.values(DEMO_SCENARIO_IDS.accounts);
const demoPersonIds = Object.values(DEMO_SCENARIO_IDS.people);
const demoMinistryIds = Object.values(DEMO_SCENARIO_IDS.ministries);
const demoMeetingIds = Object.values(DEMO_SCENARIO_IDS.meetings);
const demoAttendanceIds = Object.values(DEMO_SCENARIO_IDS.attendances);
const demoNoteIds = Object.values(DEMO_SCENARIO_IDS.notes);
const demoTimelineIds = Object.values(DEMO_SCENARIO_IDS.timeline);
const demoAuditIds = Object.values(DEMO_SCENARIO_IDS.audit);

describe("development seed", () => {
  beforeAll(async () => {
    await seed();
  }, 30000);

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { id: { in: demoAuditIds } } });
    await prisma.timelineEvent.deleteMany({ where: { id: { in: demoTimelineIds } } });
    await prisma.noteVersion.deleteMany({ where: { noteId: { in: demoNoteIds } } });
    await prisma.note.deleteMany({ where: { id: { in: demoNoteIds } } });
    await prisma.attendance.deleteMany({ where: { id: { in: demoAttendanceIds } } });
    await prisma.meetingAudience.deleteMany({ where: { meetingId: { in: demoMeetingIds } } });
    await prisma.meeting.deleteMany({ where: { id: { in: demoMeetingIds } } });
    await prisma.meetingSeries.deleteMany({ where: { id: DEMO_SCENARIO_IDS.series } });
    await prisma.category.deleteMany({ where: { id: DEMO_SCENARIO_IDS.category } });
    await prisma.accountMinistryAccess.deleteMany({ where: { accountId: { in: demoAccountIds } } });
    await prisma.ministryMembership.deleteMany({ where: { OR: [{ personId: { in: demoPersonIds } }, { ministryId: { in: demoMinistryIds } }] } });
    await prisma.account.deleteMany({ where: { id: { in: demoAccountIds } } });
    await prisma.ministry.deleteMany({ where: { id: { in: demoMinistryIds } } });
    await prisma.person.deleteMany({ where: { id: { in: demoPersonIds } } });
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

  it("creates a synthetic scenario for roles and core MVP features", async () => {
    const accounts = await prisma.account.findMany({
      where: { id: { in: demoAccountIds } },
      select: { username: true, email: true, role: true, status: true, passwordHash: true },
      orderBy: { username: "asc" },
    });
    expect(accounts.map(({ username, role, status }) => ({ username, role, status }))).toEqual([
      { username: "demo-admin", role: "ADMINISTRATOR", status: "ACTIVE" },
      { username: "demo-leader", role: "LEADER", status: "ACTIVE" },
      { username: "demo-secretary", role: "SECRETARY", status: "ACTIVE" },
    ]);
    expect(await Promise.all(accounts.map(({ passwordHash }) => import("../features/auth/password").then(({ verifyPassword }) => verifyPassword(passwordHash, DEMO_PASSWORD))))).toEqual([true, true, true]);

    const people = await prisma.person.findMany({
      where: { id: { in: demoPersonIds } },
      select: { id: true, fullName: true, status: true },
      orderBy: { id: "asc" },
    });
    expect(people.map(({ id, fullName, status }) => ({ id, fullName, status }))).toEqual([
      { id: DEMO_SCENARIO_IDS.people.administrator, fullName: "Demo Administrador", status: "MEMBER" },
      { id: DEMO_SCENARIO_IDS.people.leader, fullName: "Demo Líder", status: "MEMBER" },
      { id: DEMO_SCENARIO_IDS.people.member, fullName: "Demo Membro", status: "MEMBER" },
      { id: DEMO_SCENARIO_IDS.people.otherMinistry, fullName: "Demo Pessoa de Música", status: "MEMBER" },
      { id: DEMO_SCENARIO_IDS.people.secretary, fullName: "Demo Secretária", status: "MEMBER" },
      { id: DEMO_SCENARIO_IDS.people.visitor, fullName: "Demo Visitante", status: "VISITOR" },
      { id: DEMO_SCENARIO_IDS.people.inactive, fullName: "Demo Pessoa Inativa", status: "INACTIVE" },
    ].sort((left, right) => left.id.localeCompare(right.id)));

    const [ministries, memberships, access, series, meetings, attendances, notes, timeline, audit] = await Promise.all([
      prisma.ministry.findMany({ where: { id: { in: demoMinistryIds } }, select: { id: true, name: true, status: true }, orderBy: { id: "asc" } }),
      prisma.ministryMembership.findMany({ where: { personId: { in: demoPersonIds } }, select: { personId: true, ministryId: true, role: true, endDate: true }, orderBy: { id: "asc" } }),
      prisma.accountMinistryAccess.findUnique({ where: { accountId_ministryId: { accountId: DEMO_SCENARIO_IDS.accounts.leader, ministryId: DEMO_SCENARIO_IDS.ministries.welcome } } }),
      prisma.meetingSeries.findUnique({ where: { id: DEMO_SCENARIO_IDS.series } }),
      prisma.meeting.findMany({ where: { id: { in: demoMeetingIds } }, select: { id: true, title: true, status: true }, orderBy: { id: "asc" } }),
      prisma.attendance.findMany({ where: { id: { in: demoAttendanceIds } }, select: { personId: true, status: true }, orderBy: { personId: "asc" } }),
      prisma.note.findMany({ where: { id: { in: demoNoteIds } }, select: { id: true, content: true, archived: true }, orderBy: { id: "asc" } }),
      prisma.timelineEvent.findMany({ where: { id: { in: demoTimelineIds } }, select: { id: true, category: true }, orderBy: { occurredAt: "asc" } }),
      prisma.auditEvent.findMany({ where: { id: { in: demoAuditIds } }, select: { id: true, actorId: true, targetType: true, action: true, before: true, after: true }, orderBy: { id: "asc" } }),
    ]);

    expect(ministries).toEqual([
      { id: DEMO_SCENARIO_IDS.ministries.welcome, name: "Demo Acolhimento", status: "ACTIVE" },
      { id: DEMO_SCENARIO_IDS.ministries.music, name: "Demo Música", status: "ACTIVE" },
      { id: DEMO_SCENARIO_IDS.ministries.archived, name: "Demo Ministério Arquivado", status: "ARCHIVED" },
    ].sort((left, right) => left.id.localeCompare(right.id)));
    expect(memberships).toEqual([
      { personId: DEMO_SCENARIO_IDS.people.leader, ministryId: DEMO_SCENARIO_IDS.ministries.welcome, role: "LEADER", endDate: null },
      { personId: DEMO_SCENARIO_IDS.people.member, ministryId: DEMO_SCENARIO_IDS.ministries.welcome, role: "MEMBER", endDate: null },
      { personId: DEMO_SCENARIO_IDS.people.otherMinistry, ministryId: DEMO_SCENARIO_IDS.ministries.music, role: "MEMBER", endDate: null },
      { personId: DEMO_SCENARIO_IDS.people.inactive, ministryId: DEMO_SCENARIO_IDS.ministries.welcome, role: "MEMBER", endDate: new Date("2026-06-30T00:00:00.000Z") },
    ].sort((left, right) => left.personId.localeCompare(right.personId)));
    expect(access).toMatchObject({ accountId: DEMO_SCENARIO_IDS.accounts.leader, ministryId: DEMO_SCENARIO_IDS.ministries.welcome, revokedAt: null });
    expect(series).toMatchObject({ recurrence: "WEEKLY", weekdays: [6], startDate: new Date("2026-08-01T00:00:00.000Z"), endDate: new Date("2026-12-19T00:00:00.000Z") });
    expect(meetings).toEqual([
      { id: DEMO_SCENARIO_IDS.meetings.cancelled, title: "Demo Encontro Cancelado", status: "CANCELLED" },
      { id: DEMO_SCENARIO_IDS.meetings.scheduled, title: "Demo Encontro de Comunidade", status: "SCHEDULED" },
    ].sort((left, right) => left.id.localeCompare(right.id)));
    expect(attendances).toEqual([
      { personId: DEMO_SCENARIO_IDS.people.leader, status: "PRESENT" },
      { personId: DEMO_SCENARIO_IDS.people.member, status: "PRESENT" },
      { personId: DEMO_SCENARIO_IDS.people.visitor, status: "NOT_CONFIRMED" },
    ].sort((left, right) => left.personId.localeCompare(right.personId)));
    expect(notes).toEqual([
      { id: DEMO_SCENARIO_IDS.notes.active, content: "Demo: acompanhamento inicial", archived: false },
      { id: DEMO_SCENARIO_IDS.notes.archived, content: "Demo: registro arquivado", archived: true },
    ].sort((left, right) => left.id.localeCompare(right.id)));
    expect(timeline).toHaveLength(4);
    expect(timeline.map(({ category }) => category)).toEqual(["REGISTRATION", "ATTENDANCE", "NOTE", "CORRECTION"]);
    expect(audit).toHaveLength(2);
    expect(audit.every((event) => event.actorId === DEMO_SCENARIO_IDS.accounts.administrator)).toBe(true);
    expect(audit.map(({ targetType, action }) => ({ targetType, action }))).toEqual([
      { targetType: "Attendance", action: "UPDATE" },
      { targetType: "Person", action: "CREATE" },
    ]);
    expect(audit.find((event) => event.targetType === "Attendance")).toMatchObject({ before: { status: "NOT_CONFIRMED" }, after: { status: "PRESENT" } });
  });

  it("is safe to run again without duplicating demo records", async () => {
    await seed();

    await expect(prisma.account.count({ where: { id: { in: demoAccountIds } } })).resolves.toBe(3);
    await expect(prisma.person.count({ where: { id: { in: demoPersonIds } } })).resolves.toBe(7);
    await expect(prisma.ministryMembership.count({ where: { personId: { in: demoPersonIds } } })).resolves.toBe(4);
    await expect(prisma.attendance.count({ where: { id: { in: demoAttendanceIds } } })).resolves.toBe(3);
    await expect(prisma.note.count({ where: { id: { in: demoNoteIds } } })).resolves.toBe(2);
    await expect(prisma.timelineEvent.count({ where: { id: { in: demoTimelineIds } } })).resolves.toBe(4);
    await expect(prisma.auditEvent.count({ where: { id: { in: demoAuditIds } } })).resolves.toBe(2);
  }, 30000);

  it("uses only synthetic demo identities and local test email domains", async () => {
    const people = await prisma.person.findMany({ where: { id: { in: demoPersonIds } }, select: { fullName: true } });
    const accounts = await prisma.account.findMany({ where: { id: { in: demoAccountIds } }, select: { email: true } });

    expect(people.every(({ fullName }) => fullName.startsWith("Demo "))).toBe(true);
    expect(accounts.map(({ email }) => email).sort()).toEqual([
      "admin@emaus.test",
      "leader@emaus.test",
      "secretary@emaus.test",
    ]);
  });

  it("documents the local reset, seed and demo credentials", () => {
    const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

    expect(readme).toContain("npx prisma migrate reset --force");
    expect(readme).toContain("npm run db:seed");
    expect(readme).toContain("demo-admin");
    expect(readme).toContain("emaus-demo");
  });
});
