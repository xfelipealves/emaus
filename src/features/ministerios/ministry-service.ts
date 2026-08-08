import type { MinistryStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canAccessMinistry, canManageMinistry, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type MinistryActor = Pick<AuthorizationAccount, "role" | "ministryAccess"> & { id: string };

export type MinistryInput = {
  name: string;
  description?: string;
};

function assertCanManageMinistries(actor: MinistryActor) {
  if (!canManageMinistry(actor)) {
    throw new Error("Apenas administradores podem gerenciar Ministérios.");
  }
}

function normalizeInput(input: MinistryInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Nome do Ministério é obrigatório.");
  }

  return { name, description: input.description?.trim() || null };
}

function ministrySnapshot(ministry: { id: string; name: string; description: string | null; status: MinistryStatus }) {
  return {
    id: ministry.id,
    name: ministry.name,
    description: ministry.description,
    status: ministry.status,
  };
}

export async function listMinistries(actor: MinistryActor) {
  const where = actor.role === "LEADER"
    ? { id: { in: actor.ministryAccess.filter((access) => access.revokedAt === null).map((access) => access.ministryId) } }
    : undefined;

  return prisma.ministry.findMany({ where, orderBy: [{ status: "asc" }, { name: "asc" }] });
}

export async function createMinistry(actor: MinistryActor, input: MinistryInput) {
  assertCanManageMinistries(actor);
  const data = normalizeInput(input);

  return withTransaction(async (transaction) => {
    const ministry = await transaction.ministry.create({ data });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Ministry",
      targetId: ministry.id,
      action: "CREATE",
      after: ministrySnapshot(ministry),
    });
    return ministry;
  });
}

export async function updateMinistry(actor: MinistryActor, ministryId: string, input: MinistryInput) {
  assertCanManageMinistries(actor);
  const data = normalizeInput(input);

  return withTransaction(async (transaction) => {
    const ministry = await transaction.ministry.findUnique({ where: { id: ministryId } });
    if (!ministry) {
      throw new Error("Ministério não encontrado.");
    }

    const updated = await transaction.ministry.update({ where: { id: ministryId }, data });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Ministry",
      targetId: ministry.id,
      action: "UPDATE",
      before: ministrySnapshot(ministry),
      after: ministrySnapshot(updated),
    });
    return updated;
  });
}

export async function archiveMinistry(actor: MinistryActor, ministryId: string) {
  assertCanManageMinistries(actor);

  return withTransaction(async (transaction) => {
    const ministry = await transaction.ministry.findUnique({ where: { id: ministryId } });
    if (!ministry) {
      throw new Error("Ministério não encontrado.");
    }
    if (ministry.status === "ARCHIVED") {
      throw new Error("Ministério já está arquivado.");
    }

    const archived = await transaction.ministry.update({
      where: { id: ministryId },
      data: { status: "ARCHIVED" },
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Ministry",
      targetId: ministry.id,
      action: "ARCHIVE",
      before: ministrySnapshot(ministry),
      after: ministrySnapshot(archived),
    });
    return archived;
  });
}

export async function assertMinistryActive(ministryId: string) {
  const ministry = await prisma.ministry.findUnique({ where: { id: ministryId } });
  if (!ministry) {
    throw new Error("Ministério não encontrado.");
  }
  if (ministry.status === "ARCHIVED") {
    throw new Error("Ministério arquivado não aceita novas operações.");
  }
  return ministry;
}

export function canViewMinistry(actor: MinistryActor, ministryId: string) {
  return canAccessMinistry(actor, ministryId);
}
