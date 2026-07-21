import { AccountRole, PrismaClient, TimelineEventCategory } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const prisma = new PrismaClient();

describe("History schema", () => {
  beforeEach(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.timelineEvent.deleteMany();
    await prisma.noteVersion.deleteMany();
    await prisma.note.deleteMany();
    await prisma.account.deleteMany();
    await prisma.person.deleteMany();
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.timelineEvent.deleteMany();
    await prisma.noteVersion.deleteMany();
    await prisma.note.deleteMany();
    await prisma.account.deleteMany();
    await prisma.person.deleteMany();
    await prisma.$disconnect();
  });

  it("preserves note version author, content and sequence", async () => {
    const person = await prisma.person.create({ data: { fullName: "Pessoa acompanhada" } });
    const author = await prisma.person.create({ data: { fullName: "Autora" } });
    const account = await prisma.account.create({
      data: {
        username: "autora",
        email: "autora@example.test",
        passwordHash: "argon2-hash",
        role: AccountRole.SECRETARY,
        personId: author.id,
      },
    });
    const note = await prisma.note.create({ data: { personId: person.id, authorId: account.id } });

    await prisma.noteVersion.createMany({
      data: [
        { noteId: note.id, authorId: account.id, content: "Primeiro acompanhamento", sequence: 1 },
        { noteId: note.id, authorId: account.id, content: "Acompanhamento atualizado", sequence: 2 },
      ],
    });
    const versions = await prisma.noteVersion.findMany({
      where: { noteId: note.id },
      orderBy: { sequence: "asc" },
    });

    expect(versions.map(({ sequence }) => sequence)).toEqual([1, 2]);
    expect(versions.map(({ content }) => content)).toEqual([
      "Primeiro acompanhamento",
      "Acompanhamento atualizado",
    ]);
    expect(versions.every(({ authorId }) => authorId === account.id)).toBe(true);
  });

  it("stores audit actor, target, action and before/after values", async () => {
    const actorPerson = await prisma.person.create({ data: { fullName: "Administrador" } });
    const target = await prisma.person.create({ data: { fullName: "Alvo" } });
    const actor = await prisma.account.create({
      data: {
        username: "admin-auditoria",
        email: "admin-auditoria@example.test",
        passwordHash: "argon2-hash",
        role: AccountRole.ADMIN,
        personId: actorPerson.id,
      },
    });

    const audit = await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        targetType: "Person",
        targetId: target.id,
        action: "status_changed",
        before: { status: "VISITOR" },
        after: { status: "MEMBER" },
      },
    });

    expect(audit.actorId).toBe(actor.id);
    expect(audit.targetType).toBe("Person");
    expect(audit.targetId).toBe(target.id);
    expect(audit.action).toBe("status_changed");
    expect(audit.before).toEqual({ status: "VISITOR" });
    expect(audit.after).toEqual({ status: "MEMBER" });
  });

  it("supports timeline categories and descending timestamp queries", async () => {
    const person = await prisma.person.create({ data: { fullName: "Pessoa da timeline" } });
    const older = new Date("2026-01-01T12:00:00.000Z");
    const newer = new Date("2026-02-01T12:00:00.000Z");

    await prisma.timelineEvent.createMany({
      data: [
        {
          personId: person.id,
          category: TimelineEventCategory.STATUS,
          occurredAt: older,
          title: "Visitante cadastrado",
        },
        {
          personId: person.id,
          category: TimelineEventCategory.NOTE,
          occurredAt: newer,
          title: "Nota registrada",
        },
      ],
    });

    const timeline = await prisma.timelineEvent.findMany({
      where: { personId: person.id, category: TimelineEventCategory.NOTE },
      orderBy: { occurredAt: "desc" },
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.category).toBe(TimelineEventCategory.NOTE);
    expect(timeline[0]?.occurredAt).toEqual(newer);
  });
});
