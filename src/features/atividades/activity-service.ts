import type { ActivityBucket, Prisma } from "@prisma/client";

export type { ActivityBucket } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { recordAuditEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type ActivityActor = { id: string };

export type ActivityInput = {
  title: string;
  description?: string;
  bucket: ActivityBucket | string;
};

export type ActivityUpdateInput = ActivityInput;

export type SubtaskInput = {
  activityId: string;
  title: string;
};

export type SubtaskUpdateInput = {
  title?: string;
  completed?: boolean;
};

const activityBuckets: readonly ActivityBucket[] = ["TOMORROW", "BACKLOG", "PARKED"];

function isActivityBucket(value: string): value is ActivityBucket {
  return activityBuckets.includes(value as ActivityBucket);
}

function normalizeActivityInput(input: ActivityInput) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Título da atividade é obrigatório.");
  }
  if (!isActivityBucket(input.bucket)) {
    throw new Error("Área da atividade inválida.");
  }

  return {
    title,
    description: input.description?.trim() || null,
    bucket: input.bucket,
  };
}

function normalizeSubtaskTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) {
    throw new Error("Título da subtask é obrigatório.");
  }
  return normalized;
}

async function assertActiveActor(actor: ActivityActor) {
  const account = await prisma.account.findUnique({
    where: { id: actor.id },
    select: { status: true },
  });

  if (!account || account.status !== "ACTIVE") {
    throw new Error("Sessão inválida.");
  }
}

function activitySnapshot(activity: {
  id: string;
  title: string;
  description: string | null;
  bucket: ActivityBucket;
}) {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    bucket: activity.bucket,
  } satisfies Prisma.InputJsonObject;
}

function subtaskSnapshot(subtask: {
  id: string;
  activityId: string;
  title: string;
  completed: boolean;
}) {
  return {
    id: subtask.id,
    activityId: subtask.activityId,
    title: subtask.title,
    completed: subtask.completed,
  } satisfies Prisma.InputJsonObject;
}

export async function getActivityActor(accountId: string): Promise<ActivityActor | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, status: true },
  });

  return account?.status === "ACTIVE" ? { id: account.id } : null;
}

export async function listActivities(actor: ActivityActor, bucket?: ActivityBucket) {
  await assertActiveActor(actor);

  if (bucket !== undefined && !isActivityBucket(bucket)) {
    throw new Error("Área da atividade inválida.");
  }

  return prisma.activity.findMany({
    where: bucket ? { bucket } : undefined,
    include: {
      subtasks: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function createActivity(actor: ActivityActor, input: ActivityInput) {
  await assertActiveActor(actor);
  const data = normalizeActivityInput(input);

  return withTransaction(async (transaction) => {
    const activity = await transaction.activity.create({ data });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Activity",
      targetId: activity.id,
      action: "CREATE",
      after: activitySnapshot(activity),
    });
    return activity;
  });
}

export async function updateActivity(
  actor: ActivityActor,
  activityId: string,
  input: ActivityUpdateInput,
) {
  await assertActiveActor(actor);
  const data = normalizeActivityInput(input);

  return withTransaction(async (transaction) => {
    const current = await transaction.activity.findUnique({ where: { id: activityId } });
    if (!current) {
      throw new Error("Atividade não encontrada.");
    }

    const activity = await transaction.activity.update({ where: { id: activityId }, data });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Activity",
      targetId: activity.id,
      action: "UPDATE",
      before: activitySnapshot(current),
      after: activitySnapshot(activity),
    });
    return activity;
  });
}

export async function deleteActivity(actor: ActivityActor, activityId: string) {
  await assertActiveActor(actor);

  return withTransaction(async (transaction) => {
    const current = await transaction.activity.findUnique({
      where: { id: activityId },
      include: { subtasks: true },
    });
    if (!current) {
      throw new Error("Atividade não encontrada.");
    }

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Activity",
      targetId: current.id,
      action: "DELETE",
      before: { ...activitySnapshot(current), subtaskCount: current.subtasks.length },
    });
    await transaction.activity.delete({ where: { id: activityId } });
    return { id: activityId };
  });
}

export async function createSubtask(actor: ActivityActor, input: SubtaskInput) {
  await assertActiveActor(actor);
  const title = normalizeSubtaskTitle(input.title);

  return withTransaction(async (transaction) => {
    const activity = await transaction.activity.findUnique({ where: { id: input.activityId } });
    if (!activity) {
      throw new Error("Atividade não encontrada.");
    }

    const subtask = await transaction.activitySubtask.create({
      data: { activityId: input.activityId, title },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "ActivitySubtask",
      targetId: subtask.id,
      action: "CREATE",
      after: subtaskSnapshot(subtask),
    });
    return subtask;
  });
}

export async function updateSubtask(
  actor: ActivityActor,
  subtaskId: string,
  input: SubtaskUpdateInput,
) {
  await assertActiveActor(actor);
  const data: Prisma.ActivitySubtaskUpdateInput = {};
  if (input.title !== undefined) data.title = normalizeSubtaskTitle(input.title);
  if (input.completed !== undefined) data.completed = input.completed;
  if (Object.keys(data).length === 0) {
    throw new Error("Nenhuma alteração informada para a subtask.");
  }

  return withTransaction(async (transaction) => {
    const current = await transaction.activitySubtask.findUnique({ where: { id: subtaskId } });
    if (!current) {
      throw new Error("Subtask não encontrada.");
    }

    const subtask = await transaction.activitySubtask.update({ where: { id: subtaskId }, data });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "ActivitySubtask",
      targetId: subtask.id,
      action: "UPDATE",
      before: subtaskSnapshot(current),
      after: subtaskSnapshot(subtask),
    });
    return subtask;
  });
}

export async function deleteSubtask(actor: ActivityActor, subtaskId: string) {
  await assertActiveActor(actor);

  return withTransaction(async (transaction) => {
    const current = await transaction.activitySubtask.findUnique({ where: { id: subtaskId } });
    if (!current) {
      throw new Error("Subtask não encontrada.");
    }

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "ActivitySubtask",
      targetId: current.id,
      action: "DELETE",
      before: subtaskSnapshot(current),
    });
    await transaction.activitySubtask.delete({ where: { id: subtaskId } });
    return { id: subtaskId };
  });
}
