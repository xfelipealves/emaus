import type { MinistryMembershipRole } from "@prisma/client";
import { canManageMinistry, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent, recordTimelineEvent } from "../../server/audit";
import { withTransaction } from "../../server/transaction";

export type MembershipActor = Pick<AuthorizationAccount, "role"> & { id: string };

export type CreateMembershipInput = {
  personId: string;
  ministryId: string;
  role?: MinistryMembershipRole;
  startDate: Date;
};

export type UpdateMembershipRoleInput = {
  role: MinistryMembershipRole;
  effectiveDate?: Date;
};

export type EndMembershipInput = {
  endDate: Date;
};

function assertCanManageMemberships(actor: MembershipActor) {
  if (!canManageMinistry({ role: actor.role, ministryAccess: [] })) {
    throw new Error("Apenas administradores podem gerenciar vínculos ministeriais.");
  }
}

function membershipSnapshot(membership: {
  id: string;
  personId: string;
  ministryId: string;
  role: MinistryMembershipRole;
  startDate: Date;
  endDate: Date | null;
}) {
  return {
    id: membership.id,
    personId: membership.personId,
    ministryId: membership.ministryId,
    role: membership.role,
    startDate: membership.startDate.toISOString(),
    endDate: membership.endDate?.toISOString() ?? null,
  };
}

async function assertActiveMinistry(transaction: Parameters<Parameters<typeof withTransaction>[0]>[0], ministryId: string) {
  const ministry = await transaction.ministry.findUnique({ where: { id: ministryId } });
  if (!ministry) {
    throw new Error("Ministério não encontrado.");
  }
  if (ministry.status === "ARCHIVED") {
    throw new Error("Ministério arquivado não aceita novas operações.");
  }
}

export async function createMembership(actor: MembershipActor, input: CreateMembershipInput) {
  assertCanManageMemberships(actor);

  return withTransaction(async (transaction) => {
    await assertActiveMinistry(transaction, input.ministryId);
    const person = await transaction.person.findUnique({ where: { id: input.personId } });
    if (!person) {
      throw new Error("Pessoa não encontrada.");
    }

    const membership = await transaction.ministryMembership.create({
      data: {
        personId: input.personId,
        ministryId: input.ministryId,
        role: input.role ?? "MEMBER",
        startDate: input.startDate,
      },
    });
    const after = membershipSnapshot(membership);

    await recordTimelineEvent(transaction, {
      personId: input.personId,
      category: "MINISTRY",
      title: "Pessoa vinculada ao Ministério",
      description: `${input.ministryId} (${membership.role.toLowerCase()})`,
      occurredAt: membership.startDate,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MinistryMembership",
      targetId: membership.id,
      action: "CREATE",
      after,
    });

    return membership;
  });
}

export async function updateMembershipRole(
  actor: MembershipActor,
  membershipId: string,
  input: UpdateMembershipRoleInput,
) {
  assertCanManageMemberships(actor);

  return withTransaction(async (transaction) => {
    const membership = await transaction.ministryMembership.findUnique({ where: { id: membershipId } });
    if (!membership) {
      throw new Error("Vínculo ministerial não encontrado.");
    }
    await assertActiveMinistry(transaction, membership.ministryId);

    const updated = await transaction.ministryMembership.update({
      where: { id: membershipId },
      data: { role: input.role },
    });
    const effectiveDate = input.effectiveDate ?? new Date();

    await recordTimelineEvent(transaction, {
      personId: membership.personId,
      category: "MINISTRY",
      title: "Cargo no Ministério alterado",
      description: `${membership.role.toLowerCase()} para ${updated.role.toLowerCase()}`,
      occurredAt: effectiveDate,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MinistryMembership",
      targetId: membership.id,
      action: "UPDATE_ROLE",
      before: membershipSnapshot(membership),
      after: membershipSnapshot(updated),
    });

    return updated;
  });
}

export async function endMembership(
  actor: MembershipActor,
  membershipId: string,
  input: EndMembershipInput,
) {
  assertCanManageMemberships(actor);

  return withTransaction(async (transaction) => {
    const membership = await transaction.ministryMembership.findUnique({ where: { id: membershipId } });
    if (!membership) {
      throw new Error("Vínculo ministerial não encontrado.");
    }
    if (membership.endDate) {
      throw new Error("Vínculo ministerial já está encerrado.");
    }

    const updated = await transaction.ministryMembership.update({
      where: { id: membershipId },
      data: { endDate: input.endDate },
    });

    await recordTimelineEvent(transaction, {
      personId: membership.personId,
      category: "MINISTRY",
      title: "Vínculo ministerial encerrado",
      description: membership.ministryId,
      occurredAt: input.endDate,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MinistryMembership",
      targetId: membership.id,
      action: "END",
      before: membershipSnapshot(membership),
      after: membershipSnapshot(updated),
    });

    return updated;
  });
}
