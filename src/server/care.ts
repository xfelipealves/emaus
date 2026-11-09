import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { FOLLOW_UP_KIND_LABEL } from "@/lib/labels";
import { recordTimeline } from "./history";
import { ActionError, assertCanSeePerson, type CurrentUser, visiblePersonIds } from "./session";

/* ───────────── Notas ───────────── */

export async function addNote(user: CurrentUser, personId: string, content: string, pastoral = false) {
  await assertCanSeePerson(user, personId);
  const text = content.trim();
  if (!text) throw new ActionError("Escreva a anotação.");
  if (pastoral && user.role !== "admin") throw new ActionError("Só pastores registram anotações confidenciais.");
  await db.insert(schema.note).values({ personId, authorId: user.id, content: text, visibility: pastoral ? "pastoral" : "team" });
}

/** Anotação pastoral é invisível para quem não é administrador. */
async function visibleNote(user: CurrentUser, noteId: string) {
  const n = await db.query.note.findFirst({ where: eq(schema.note.id, noteId) });
  if (!n || (n.visibility === "pastoral" && user.role !== "admin")) throw new ActionError("Anotação não encontrada.");
  await assertCanSeePerson(user, n.personId);
  return n;
}

async function ownNote(user: CurrentUser, noteId: string) {
  const n = await visibleNote(user, noteId);
  if (n.authorId !== user.id && user.role !== "admin") {
    throw new ActionError("Só o autor ou um administrador pode alterar esta anotação.");
  }
  return n;
}

export async function editNote(user: CurrentUser, noteId: string, content: string) {
  await ownNote(user, noteId);
  const text = content.trim();
  if (!text) throw new ActionError("Escreva a anotação.");
  await db.update(schema.note).set({ content: text, editedAt: new Date() }).where(eq(schema.note.id, noteId));
}

export async function toggleNotePin(user: CurrentUser, noteId: string) {
  const n = await visibleNote(user, noteId);
  await db.update(schema.note).set({ pinned: !n.pinned }).where(eq(schema.note.id, noteId));
}

export async function deleteNote(user: CurrentUser, noteId: string) {
  await ownNote(user, noteId);
  await db.delete(schema.note).where(eq(schema.note.id, noteId));
}

/* ───────────── Acompanhamentos ───────────── */

export const followUpInput = z.object({
  personId: z.string().min(1, "Escolha a pessoa"),
  title: z.string().trim().min(2, "Descreva o acompanhamento").max(160),
  kind: z.enum(["call", "visit", "message", "prayer", "other"]).default("call"),
  assigneeId: z.string().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createFollowUp(user: CurrentUser, raw: unknown) {
  const input = followUpInput.parse(raw);
  await assertCanSeePerson(user, input.personId);
  await db.insert(schema.followUp).values({
    personId: input.personId,
    title: input.title,
    kind: input.kind,
    assigneeId: input.assigneeId ?? user.id,
    createdById: user.id,
    dueDate: input.dueDate ?? null,
  });
}

export async function completeFollowUp(user: CurrentUser, id: string, outcome?: string) {
  const f = await db.query.followUp.findFirst({ where: eq(schema.followUp.id, id) });
  if (!f) throw new ActionError("Acompanhamento não encontrado.");
  await assertCanSeePerson(user, f.personId);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.followUp)
      .set({ doneAt: new Date(), outcome: outcome?.trim() || null })
      .where(eq(schema.followUp.id, id));
    await recordTimeline(tx, {
      personId: f.personId,
      actorId: user.id,
      kind: "follow_up",
      title: `${FOLLOW_UP_KIND_LABEL[f.kind]}: ${f.title}`,
      detail: outcome?.trim() || null,
    });
  });
}

export async function reopenFollowUp(user: CurrentUser, id: string) {
  const f = await db.query.followUp.findFirst({ where: eq(schema.followUp.id, id) });
  if (!f) throw new ActionError("Acompanhamento não encontrado.");
  await assertCanSeePerson(user, f.personId);
  await db.update(schema.followUp).set({ doneAt: null, outcome: null }).where(eq(schema.followUp.id, id));
}

export async function deleteFollowUp(user: CurrentUser, id: string) {
  const f = await db.query.followUp.findFirst({ where: eq(schema.followUp.id, id) });
  if (!f) throw new ActionError("Acompanhamento não encontrado.");
  await assertCanSeePerson(user, f.personId);
  await db.delete(schema.followUp).where(eq(schema.followUp.id, id));
}

export async function listFollowUps(
  user: CurrentUser,
  opts: { done?: boolean; assigneeId?: string; personId?: string } = {},
) {
  const visible = await visiblePersonIds(user);
  const rows = await db.query.followUp.findMany({
    where: and(
      opts.done ? isNotNull(schema.followUp.doneAt) : isNull(schema.followUp.doneAt),
      opts.assigneeId ? eq(schema.followUp.assigneeId, opts.assigneeId) : undefined,
      opts.personId ? eq(schema.followUp.personId, opts.personId) : undefined,
    ),
    with: {
      person: { columns: { id: true, fullName: true, preferredName: true, phone: true, status: true } },
      assignee: { columns: { id: true, name: true } },
    },
    orderBy: opts.done
      ? desc(schema.followUp.doneAt)
      : [asc(sql`coalesce(${schema.followUp.dueDate}, '9999')`), asc(schema.followUp.createdAt)],
    limit: opts.done ? 100 : undefined,
  });
  return visible ? rows.filter((r) => visible.has(r.personId)) : rows;
}

export async function listAssignees() {
  return db.query.user.findMany({
    where: eq(schema.user.active, true),
    columns: { id: true, name: true },
    orderBy: asc(schema.user.name),
  });
}
