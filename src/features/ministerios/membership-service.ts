import { Prisma, type MinistryMembershipRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { BRAZIL_TIME_ZONE, formatDateOnly, normalizeDateOnly } from "../../lib/dates";
import { canManageMinistry, type AuthorizationAccount } from "../../server/authorization";
import { recordAuditEvent, recordTimelineEvent } from "../../server/audit";

export type MembershipActor = Pick<AuthorizationAccount, "role"> & { id: string };

export type CreateMembershipInput = {
  personId: string;
  ministryId: string;
  role: MinistryMembershipRole;
  startDate: Date;
};

export type UpdateMembershipRoleInput = {
  role: MinistryMembershipRole;
  effectiveDate: Date;
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

function normalizeMembershipRole(role: MinistryMembershipRole) {
  if (role !== "MEMBER" && role !== "LEADER") {
    throw new Error("Cargo deve ser membro ou líder.");
  }
  return role;
}

function todayInBrazil() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
  );
  return normalizeDateOnly(new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`));
}

function normalizeStartDate(date: Date) {
  const startDate = normalizeDateOnly(date);
  if (startDate.getTime() > todayInBrazil().getTime()) {
    throw new Error("Data de entrada não pode ser futura.");
  }
  return startDate;
}

function normalizeEffectiveDate(date: Date, label: string) {
  const effectiveDate = normalizeDateOnly(date);
  if (effectiveDate.getTime() > todayInBrazil().getTime()) {
    throw new Error(`${label} não pode ser futura.`);
  }
  return effectiveDate;
}

async function assertActiveMinistry(transaction: Prisma.TransactionClient, ministryId: string) {
  const ministry = await transaction.ministry.findUnique({ where: { id: ministryId } });
  if (!ministry) {
    throw new Error("Ministério não encontrado.");
  }
  if (ministry.status === "ARCHIVED") {
    throw new Error("Ministério arquivado não aceita novas operações.");
  }
  return ministry;
}

function withSerializableTransaction<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function isTransactionConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

export async function getMinistryMembershipManagement(actor: MembershipActor, ministryId: string) {
  assertCanManageMemberships(actor);

  const ministry = await prisma.ministry.findUnique({
    where: { id: ministryId },
    include: {
      memberships: {
        orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
        include: { person: { select: { id: true, fullName: true, status: true } } },
      },
    },
  });
  if (!ministry) return null;

  const people = await prisma.person.findMany({
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    select: { id: true, fullName: true, status: true },
  });

  return {
    ministry,
    currentMemberships: ministry.memberships.filter((membership) => membership.endDate === null),
    historicMemberships: ministry.memberships.filter((membership) => membership.endDate !== null),
    people,
  };
}

export async function createMembership(actor: MembershipActor, input: CreateMembershipInput) {
  assertCanManageMemberships(actor);
  const role = normalizeMembershipRole(input.role);
  const startDate = normalizeStartDate(input.startDate);

  try {
    return await withSerializableTransaction(async (transaction) => {
      const ministry = await assertActiveMinistry(transaction, input.ministryId);
      const person = await transaction.person.findUnique({ where: { id: input.personId } });
      if (!person) {
        throw new Error("Pessoa não encontrada.");
      }

      const previousMemberships = await transaction.ministryMembership.findMany({
        where: { personId: input.personId, ministryId: input.ministryId },
        select: { endDate: true },
      });
      if (previousMemberships.some((membership) => membership.endDate === null)) {
        throw new Error("A Pessoa já possui vínculo vigente neste Ministério.");
      }
      const lastEndDate = previousMemberships.reduce<Date | null>(
        (latest, membership) => membership.endDate && (!latest || membership.endDate > latest) ? membership.endDate : latest,
        null,
      );
      if (lastEndDate && startDate.getTime() <= normalizeDateOnly(lastEndDate).getTime()) {
        throw new Error("Data de entrada deve ser posterior à saída anterior.");
      }

      const membership = await transaction.ministryMembership.create({
        data: {
          personId: input.personId,
          ministryId: input.ministryId,
          role,
          startDate,
        },
      });
      const after = membershipSnapshot(membership);

      await recordTimelineEvent(transaction, {
        personId: input.personId,
        category: "MINISTRY",
        title: "Pessoa vinculada ao Ministério",
        description: `${ministry.name} · Cargo: ${membership.role === "LEADER" ? "Líder" : "Membro"} · Entrada: ${formatDateOnly(startDate)}`,
        occurredAt: startDate,
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
  } catch (error) {
    if (isTransactionConflict(error)) {
      throw new Error("A Pessoa já possui vínculo vigente neste Ministério ou o período conflita com outra entrada.");
    }
    throw error;
  }
}

export async function updateMembershipRole(
  actor: MembershipActor,
  membershipId: string,
  input: UpdateMembershipRoleInput,
) {
  assertCanManageMemberships(actor);
  const role = normalizeMembershipRole(input.role);
  const effectiveDate = normalizeEffectiveDate(input.effectiveDate, "Data efetiva do cargo");

  return withSerializableTransaction(async (transaction) => {
    const membership = await transaction.ministryMembership.findUnique({ where: { id: membershipId } });
    if (!membership) {
      throw new Error("Vínculo ministerial não encontrado.");
    }
    if (membership.endDate) {
      throw new Error("Vínculo ministerial encerrado não pode ter o cargo alterado.");
    }
    const ministry = await assertActiveMinistry(transaction, membership.ministryId);
    if (effectiveDate.getTime() < normalizeDateOnly(membership.startDate).getTime()) {
      throw new Error("Data efetiva do cargo não pode ser anterior ao início do vínculo.");
    }

    const updated = await transaction.ministryMembership.update({
      where: { id: membershipId },
      data: { role },
    });

    await recordTimelineEvent(transaction, {
      personId: membership.personId,
      category: "MINISTRY",
      title: "Cargo no Ministério alterado",
      description: `${ministry.name} · Cargo: ${membership.role === "LEADER" ? "Líder" : "Membro"} → ${updated.role === "LEADER" ? "Líder" : "Membro"} · Efeito em ${formatDateOnly(effectiveDate)}`,
      occurredAt: effectiveDate,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MinistryMembership",
      targetId: membership.id,
      action: "UPDATE_ROLE",
      before: membershipSnapshot(membership),
      after: { ...membershipSnapshot(updated), effectiveDate: effectiveDate.toISOString() },
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
  const endDate = normalizeEffectiveDate(input.endDate, "Data de saída");

  return withSerializableTransaction(async (transaction) => {
    const membership = await transaction.ministryMembership.findUnique({ where: { id: membershipId } });
    if (!membership) {
      throw new Error("Vínculo ministerial não encontrado.");
    }
    if (membership.endDate) {
      throw new Error("Vínculo ministerial já está encerrado.");
    }
    if (endDate.getTime() < normalizeDateOnly(membership.startDate).getTime()) {
      throw new Error("Data de saída não pode ser anterior ao início do vínculo.");
    }
    const ministry = await transaction.ministry.findUnique({ where: { id: membership.ministryId } });
    if (!ministry) {
      throw new Error("Ministério não encontrado.");
    }

    const updated = await transaction.ministryMembership.update({
      where: { id: membershipId },
      data: { endDate },
    });

    await recordTimelineEvent(transaction, {
      personId: membership.personId,
      category: "MINISTRY",
      title: "Vínculo ministerial encerrado",
      description: `${ministry.name} · Saída: ${formatDateOnly(endDate)}`,
      occurredAt: endDate,
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
