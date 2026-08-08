import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { createNote, listPersonNotes, updateNote } from "./note-service";

describe("note service", () => {
  const suffix = Date.now().toString();
  let accountId: string;
  let personId: string;

  beforeAll(async () => {
    const account = await prisma.account.create({
      data: {
        username: `t31-${suffix}`,
        email: `t31-${suffix}@example.test`,
        passwordHash: "test-hash",
        role: "SECRETARY",
        person: { create: { fullName: `Autor T31 ${suffix}` } },
      },
    });
    accountId = account.id;
    const person = await prisma.person.create({ data: { fullName: `Pessoa Nota T31 ${suffix}` } });
    personId = person.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: accountId } });
    await prisma.timelineEvent.deleteMany({ where: { personId } });
    await prisma.noteVersion.deleteMany({ where: { note: { personId } } });
    await prisma.note.deleteMany({ where: { personId } });
    await prisma.account.delete({ where: { id: accountId } });
    await prisma.person.delete({ where: { id: personId } });
  });

  it("creates a note with its first complete version, timeline and audit", async () => {
    const note = await createNote({ id: accountId, role: "SECRETARY" }, personId, "  Primeiro acompanhamento  ");

    const version = await prisma.noteVersion.findFirstOrThrow({ where: { noteId: note.id } });
    const timeline = await prisma.timelineEvent.findFirstOrThrow({ where: { personId, category: "NOTE" } });
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { targetType: "Note", targetId: note.id, action: "CREATE" } });

    expect(note.content).toBe("Primeiro acompanhamento");
    expect(note.authorId).toBe(accountId);
    expect(version).toMatchObject({ authorId: accountId, content: "Primeiro acompanhamento", sequence: 1 });
    expect(timeline).toMatchObject({ title: "Nota adicionada", description: "Primeiro acompanhamento", personId });
    expect(audit).toMatchObject({ actorId: accountId, before: null, after: { id: note.id, personId, content: "Primeiro acompanhamento", archived: false } });
  });

  it("edits a note by preserving the old version and recording the new state", async () => {
    const note = (await listPersonNotes({ id: accountId, role: "SECRETARY" }, personId))[0];
    const updated = await updateNote({ id: accountId, role: "SECRETARY" }, note.id, "Segundo acompanhamento");
    const versions = await prisma.noteVersion.findMany({ where: { noteId: note.id }, orderBy: { sequence: "asc" } });
    const timeline = await prisma.timelineEvent.findMany({ where: { personId, category: "NOTE" }, orderBy: { occurredAt: "asc" } });
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { targetType: "Note", targetId: note.id, action: "UPDATE" } });

    expect(updated.content).toBe("Segundo acompanhamento");
    expect(versions.map(({ content, sequence, authorId }) => ({ content, sequence, authorId }))).toEqual([
      { content: "Primeiro acompanhamento", sequence: 1, authorId: accountId },
      { content: "Segundo acompanhamento", sequence: 2, authorId: accountId },
    ]);
    expect(timeline.map(({ title, description }) => ({ title, description }))).toEqual([
      { title: "Nota adicionada", description: "Primeiro acompanhamento" },
      { title: "Nota editada", description: "Segundo acompanhamento" },
    ]);
    expect(audit).toMatchObject({ actorId: accountId, before: { content: "Primeiro acompanhamento" }, after: { content: "Segundo acompanhamento" } });
  });
});
