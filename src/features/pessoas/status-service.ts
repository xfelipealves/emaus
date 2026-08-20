import type { PersonStatus } from "@prisma/client";
import { canManagePeople, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent, recordTimelineEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";
import type { PersonActor } from "./person-service";
import { normalizeDateOnly } from "../../lib/dates";

export type PromotePersonInput = {
  phone: string;
  birthDate: Date;
  effectiveDate?: Date;
};

export type InactivatePersonInput = {
  effectiveDate?: Date;
};

function assertCanManagePeople(actor: PersonActor) {
  const authorizationAccount: AuthorizationAccount = {
    role: actor.role,
    ministryAccess: [],
  };

  if (!canManagePeople(authorizationAccount)) {
    throw new Error("Você não tem permissão para gerenciar Pessoas.");
  }
}

export function validatePromotionInput(input: PromotePersonInput) {
  const phone = input.phone.trim();
  if (!phone) {
    throw new Error("Telefone é obrigatório para promover a membro.");
  }

  if (!input.birthDate) {
    throw new Error("Data de nascimento é obrigatória para promover a membro.");
  }

  return { phone, birthDate: normalizeDateOnly(input.birthDate) };
}

function personSnapshot(person: {
  id: string;
  fullName: string;
  status: PersonStatus;
  phone: string | null;
  birthDate: Date | null;
  statusChangedAt: Date;
}) {
  return {
    id: person.id,
    fullName: person.fullName,
    status: person.status,
    phone: person.phone,
    birthDate: person.birthDate?.toISOString() ?? null,
    statusChangedAt: person.statusChangedAt.toISOString(),
  };
}

export async function promoteToMember(
  actor: PersonActor,
  personId: string,
  input: PromotePersonInput,
) {
  assertCanManagePeople(actor);
  const { phone, birthDate } = validatePromotionInput(input);
  const effectiveDate = input.effectiveDate ?? new Date();

  return withTransaction(async (transaction) => {
    const person = await transaction.person.findUnique({ where: { id: personId } });
    if (!person) {
      throw new Error("Pessoa não encontrada.");
    }
    if (person.status !== "VISITOR") {
      throw new Error("Somente visitantes podem ser promovidos a membros.");
    }

    const updatedPerson = await transaction.person.update({
      where: { id: personId },
      data: { status: "MEMBER", phone, birthDate, statusChangedAt: effectiveDate },
    });

    await recordTimelineEvent(transaction, {
      personId,
      category: "STATUS",
      title: "Pessoa promovida a membro",
      description: updatedPerson.fullName,
      occurredAt: effectiveDate,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Person",
      targetId: personId,
      action: "PROMOTE_TO_MEMBER",
      before: personSnapshot(person),
      after: personSnapshot(updatedPerson),
    });

    return updatedPerson;
  });
}

export async function inactivatePerson(
  actor: PersonActor,
  personId: string,
  input: InactivatePersonInput = {},
) {
  assertCanManagePeople(actor);
  const effectiveDate = input.effectiveDate ?? new Date();

  return withTransaction(async (transaction) => {
    const person = await transaction.person.findUnique({ where: { id: personId } });
    if (!person) {
      throw new Error("Pessoa não encontrada.");
    }
    if (person.status === "INACTIVE") {
      throw new Error("Pessoa já está inativa.");
    }

    const updatedPerson = await transaction.person.update({
      where: { id: personId },
      data: { status: "INACTIVE", statusChangedAt: effectiveDate },
    });

    await recordTimelineEvent(transaction, {
      personId,
      category: "STATUS",
      title: "Pessoa inativada",
      description: updatedPerson.fullName,
      occurredAt: effectiveDate,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Person",
      targetId: personId,
      action: "INACTIVATE",
      before: personSnapshot(person),
      after: personSnapshot(updatedPerson),
    });

    return updatedPerson;
  });
}
