import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";

describe("History and audit persistence", () => {
  let personId: string;
  let accountId: string;
  let noteId: string;

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: "Pessoa de integração T09" },
    });
    personId = person.id;

    const account = await prisma.account.create({
      data: {
        personId,
        username: "integracao-t09",
        email: "integracao-t09@example.test",
        passwordHash: "test-hash",
      },
    });
    accountId = account.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: accountId } });
    await prisma.timelineEvent.deleteMany({ where: { personId } });
    await prisma.noteVersion.deleteMany({ where: { authorId: accountId } });
    await prisma.note.deleteMany({ where: { id: noteId } });
    await prisma.account.delete({ where: { id: accountId } });
    await prisma.person.delete({ where: { id: personId } });
    await prisma.$disconnect();
  });

  it("preserves complete note versions with author and sequence", async () => {
    const note = await prisma.note.create({
      data: {
        personId,
        authorId: accountId,
        content: "Primeiro acompanhamento",
        versions: {
          create: {
            authorId: accountId,
            content: "Primeiro acompanhamento",
            sequence: 1,
          },
        },
      },
      include: { versions: true },
    });
    noteId = note.id;

    const version = note.versions[0];
    expect(version.authorId).toBe(accountId);
    expect(version.content).toBe("Primeiro acompanhamento");
    expect(version.sequence).toBe(1);

    const edited = await prisma.noteVersion.create({
      data: {
        noteId,
        authorId: accountId,
        content: "Acompanhamento atualizado",
        sequence: 2,
      },
    });
    expect(edited.sequence).toBe(2);
    expect(edited.content).toBe("Acompanhamento atualizado");
  });

  it("stores categorized timeline events with timestamps for a person", async () => {
    const occurredAt = new Date("2026-08-08T12:00:00.000Z");
    const event = await prisma.timelineEvent.create({
      data: {
        personId,
        category: "NOTE",
        title: "Nota adicionada",
        description: "Acompanhamento atualizado",
        occurredAt,
      },
    });

    const timeline = await prisma.timelineEvent.findMany({
      where: { personId },
      orderBy: { occurredAt: "desc" },
    });
    expect(timeline[0].id).toBe(event.id);
    expect(timeline[0].category).toBe("NOTE");
    expect(timeline[0].occurredAt).toEqual(occurredAt);
  });

  it("stores audit actor, target, action and before/after values", async () => {
    const audit = await prisma.auditEvent.create({
      data: {
        actorId: accountId,
        targetType: "Note",
        targetId: noteId,
        action: "UPDATE",
        before: { content: "Primeiro acompanhamento" },
        after: { content: "Acompanhamento atualizado" },
        reason: "Correção de acompanhamento",
      },
    });

    expect(audit.actorId).toBe(accountId);
    expect(audit.targetType).toBe("Note");
    expect(audit.targetId).toBe(noteId);
    expect(audit.action).toBe("UPDATE");
    expect(audit.before).toEqual({ content: "Primeiro acompanhamento" });
    expect(audit.after).toEqual({ content: "Acompanhamento atualizado" });
    expect(audit.reason).toBe("Correção de acompanhamento");
    expect(audit.createdAt).toBeInstanceOf(Date);
  });
});
