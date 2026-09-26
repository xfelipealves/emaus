import type { AccountRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canAccessPerson } from "../../server/authorization";
import { recordAuditEvent, recordTimelineEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type NoteActor = { id: string; role: AccountRole };

export type PersonNote = {
  id: string;
  personId: string;
  authorId: string | null;
  content: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NoteFilter = "active" | "archived";

export function validateNoteContent(content: string): string {
  const normalized = content.trim();
  if (!normalized) {
    throw new Error("O conteúdo da nota é obrigatório.");
  }
  return normalized;
}

async function assertCanAccessPerson(actor: NoteActor, personId: string) {
  const account = await prisma.account.findUnique({
    where: { id: actor.id },
    select: {
      role: true,
      status: true,
      ministryAccess: { where: { revokedAt: null }, select: { ministryId: true, revokedAt: true } },
    },
  });
  if (!account || account.status !== "ACTIVE" || account.role !== actor.role) {
    throw new Error("Você não tem permissão para consultar esta Pessoa.");
  }

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { memberships: { select: { ministryId: true } } },
  });
  if (!person || !canAccessPerson(account, person.memberships.map(({ ministryId }) => ministryId))) {
    throw new Error("Você não tem permissão para consultar esta Pessoa.");
  }
}

export async function listPersonNotes(actor: NoteActor, personId: string, filter: NoteFilter = "active"): Promise<PersonNote[]> {
  await assertCanAccessPerson(actor, personId);
  return prisma.note.findMany({
    where: { personId, archived: filter === "archived" },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, personId: true, authorId: true, content: true, archived: true, createdAt: true, updatedAt: true },
  });
}

export async function createNote(actor: NoteActor, personId: string, content: string) {
  const normalizedContent = validateNoteContent(content);
  await assertCanAccessPerson(actor, personId);

  return withTransaction(async (transaction) => {
    const note = await transaction.note.create({
      data: {
        personId,
        authorId: actor.id,
        content: normalizedContent,
        versions: { create: { authorId: actor.id, content: normalizedContent, sequence: 1 } },
      },
    });

    await recordTimelineEvent(transaction, {
      personId,
      category: "NOTE",
      title: "Nota adicionada",
      description: normalizedContent,
      occurredAt: note.createdAt,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Note",
      targetId: note.id,
      action: "CREATE",
      after: { id: note.id, personId, content: normalizedContent, archived: false },
    });

    return note;
  });
}

export async function updateNote(actor: NoteActor, noteId: string, content: string) {
  const normalizedContent = validateNoteContent(content);
  const existing = await prisma.note.findUnique({ where: { id: noteId }, select: { personId: true } });
  if (!existing) throw new Error("Nota não encontrada.");
  await assertCanAccessPerson(actor, existing.personId);

  return withTransaction(async (transaction) => {
    const note = await transaction.note.findUnique({ where: { id: noteId } });
    if (!note) throw new Error("Nota não encontrada.");

    const lastVersion = await transaction.noteVersion.findFirst({
      where: { noteId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const updatedNote = await transaction.note.update({
      where: { id: noteId },
      data: {
        content: normalizedContent,
        versions: { create: { authorId: actor.id, content: normalizedContent, sequence: (lastVersion?.sequence ?? 0) + 1 } },
      },
    });

    await recordTimelineEvent(transaction, {
      personId: note.personId,
      category: "NOTE",
      title: "Nota editada",
      description: normalizedContent,
      occurredAt: updatedNote.updatedAt,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Note",
      targetId: note.id,
      action: "UPDATE",
      before: { id: note.id, personId: note.personId, content: note.content, archived: note.archived },
      after: { id: updatedNote.id, personId: updatedNote.personId, content: updatedNote.content, archived: updatedNote.archived },
    });

    return updatedNote;
  });
}

export async function archiveNote(actor: NoteActor, noteId: string) {
  const existing = await prisma.note.findUnique({ where: { id: noteId } });
  if (!existing) throw new Error("Nota não encontrada.");
  await assertCanAccessPerson(actor, existing.personId);

  return withTransaction(async (transaction) => {
    const note = await transaction.note.findUnique({ where: { id: noteId } });
    if (!note) throw new Error("Nota não encontrada.");
    if (note.archived) return note;

    const archivedNote = await transaction.note.update({
      where: { id: noteId },
      data: { archived: true },
    });

    await recordTimelineEvent(transaction, {
      personId: note.personId,
      category: "NOTE",
      title: "Nota arquivada",
      description: note.content,
      occurredAt: archivedNote.updatedAt,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Note",
      targetId: note.id,
      action: "ARCHIVE",
      before: { id: note.id, personId: note.personId, content: note.content, archived: false },
      after: { id: archivedNote.id, personId: archivedNote.personId, content: archivedNote.content, archived: true },
    });

    return archivedNote;
  });
}
