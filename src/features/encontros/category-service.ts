import type { Category } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { canManageMinistry, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type CategoryActor = Pick<AuthorizationAccount, "role" | "ministryAccess"> & { id: string };

export type CategoryInput = {
  name: string;
  description?: string;
};

function assertAdministrator(actor: CategoryActor) {
  if (!canManageMinistry(actor)) {
    throw new Error("Apenas administradores podem gerenciar categorias.");
  }
}

function normalizeInput(input: CategoryInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Nome da categoria é obrigatório.");
  return { name, description: input.description?.trim() || null };
}

function snapshot(category: Pick<Category, "id" | "name" | "description">) {
  return { id: category.id, name: category.name, description: category.description };
}

export function listCategories(actor: CategoryActor) {
  assertAdministrator(actor);
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function createCategory(actor: CategoryActor, input: CategoryInput) {
  assertAdministrator(actor);
  const data = normalizeInput(input);

  return withTransaction(async (transaction) => {
    const category = await transaction.category.create({ data });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Category",
      targetId: category.id,
      action: "CREATE",
      after: snapshot(category),
    });
    return category;
  });
}

export async function updateCategory(actor: CategoryActor, categoryId: string, input: CategoryInput) {
  assertAdministrator(actor);
  const data = normalizeInput(input);

  return withTransaction(async (transaction) => {
    const category = await transaction.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new Error("Categoria não encontrada.");
    const updated = await transaction.category.update({ where: { id: categoryId }, data });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Category",
      targetId: categoryId,
      action: "UPDATE",
      before: snapshot(category),
      after: snapshot(updated),
    });
    return updated;
  });
}
