import type { PersonStatus } from "@prisma/client";
import { canManagePeople, type AuthorizationAccount } from "../../server/authorization";
import {
  recordAuditEvent,
  recordTimelineEvent,
} from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type PersonActor = Pick<AuthorizationAccount, "role"> & {
  id: string;
};

export type CreatePersonInput = {
  fullName: string;
  status?: PersonStatus;
  phone?: string;
  birthDate?: Date;
  profilePhotoUrl?: string;
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

export async function createPerson(actor: PersonActor, input: CreatePersonInput) {
  assertCanManagePeople(actor);

  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new Error("Nome completo é obrigatório.");
  }

  return withTransaction(async (transaction) => {
    const person = await transaction.person.create({
      data: {
        fullName,
        status: input.status ?? "VISITOR",
        phone: input.phone,
        birthDate: input.birthDate,
        profilePhotoUrl: input.profilePhotoUrl,
      },
    });

    const after = {
      id: person.id,
      fullName: person.fullName,
      status: person.status,
      phone: person.phone,
      birthDate: person.birthDate?.toISOString() ?? null,
      profilePhotoUrl: person.profilePhotoUrl,
    };

    await recordTimelineEvent(transaction, {
      personId: person.id,
      category: "REGISTRATION",
      title: "Pessoa cadastrada",
      description: person.fullName,
      occurredAt: person.createdAt,
    });

    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "Person",
      targetId: person.id,
      action: "CREATE",
      after,
    });

    return person;
  });
}
