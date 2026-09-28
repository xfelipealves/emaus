import { Prisma, type MinistryMembershipRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { formatDateOnly, normalizeDateOnly, BRAZIL_TIME_ZONE } from "../../lib/dates";
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

async function assertActiveAdministrator(transaction: Prisma.TransactionClient, actor: MembershipActor) {
  const account = await transaction.account.findUnique({
    where: { id: actor.id },
    select: { role: true, status: true },
  });
  if (!account || account.status !== "ACTIVE" || account.role !== actor.role || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores ativos podem gerenciar vínculos ministeriais.");
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
  const value = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return normalizeDateOnly(new Date(`${value}T00:00:00.000Z`));
}

function normalizeEffectiveDate(date: Date, label: string) {
  const effectiveDate = normalizeDateOnly(date);
  if (effectiveDate.getTime() > todayInBrazil().getTime()) {
    throw new Error(`${label} não pode ser futura.`);
  }
  return effectiveDate;
}

function normalizeStartDate(date: Date) {
  return normalizeEffectiveDate(date, "Data de entrada");
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

async function getMembershipContext(transaction: Prisma.TransactionClient, membershipId: string) {
  const membership = await transaction.ministryMembership.findUnique({
    where: { id: membershipId },
    include: {
      person: { select: { fullName: true } },
      ministry: { select: { id: true, name: true, status: true } },
    },
  });
  if (!membership) {
    throw new Error("Vínculo ministerial não encontrado.");
  }
  return membership;
}

function withSerializableTransaction<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function isTransactionConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

async function withConflictMessage<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    if (isTransactionConflict(error)) {
      throw new Error("O vínculo foi alterado por outra operação. Atualize a página e tente novamente.");
    }
    throw error;
  }
}

export async function getMinistryMembershipManagement(actor: MembershipActor, ministryId: string) {
  assertCanManageMemberships(actor);
  const account = await prisma.account.findUnique({
    where: { id: actor.id },
    select: { role: true, status: true },
  });
  if (!account || account.status !== "ACTIVE" || account.role !== actor.role || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores ativos podem consultar o histórico de vínculos.");
  }

  const ministry = await prisma.ministry.findUnique({
    where: { id: ministryId },
    include: {
      memberships: {
        orderBy: [{ startDate: "desc" }, { id: "desc" }],
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

  return withConflictMessage(() => withSerializableTransaction(async (transaction) => {
    await assertActiveAdministrator(transaction, actor);
    const ministry = await assertActiveMinistry(transaction, input.ministryId);
    const person = await transaction.person.findUnique({
      where: { id: input.personId },
      select: { id: true, fullName: true },
    });
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
      data: { personId: input.personId, ministryId: input.ministryId, role, startDate },
    });
    await recordTimelineEvent(transaction, {
      personId: person.id,
      actorId: actor.id,
      category: "MINISTRY",
      title: "Pessoa vinculada ao Ministério",
      description: `${person.fullName} · ${ministry.name} · ${role === "LEADER" ? "Líder" : "Membro"} · Entrada: ${formatDateOnly(startDate)}`,
      occurredAt: startDate,
    });
    await recordAuditEvent(transaction, {
      actorId: actor.id,
      targetType: "MinistryMembership",
      targetId: membership.id,
      action: "CREATE",
      after: membershipSnapshot(membership),
    });

    return membership;
  }));
}

export async function updateMembershipRole(
  actor: MembershipActor,
  membershipId: string,
  input: UpdateMembershipRoleInput,
) {
  assertCanManageMemberships(actor);
  const role = normalizeMembershipRole(input.role);
  const effectiveDate = normalizeEffectiveDate(input.effectiveDate, "Data efetiva do cargo");

  return withConflictMessage(() => withSerializableTransaction(async (transaction) => {
    await assertActiveAdministrator(transaction, actor);
    const membership = await getMembershipContext(transaction, membershipId);
    if (membership.endDate) {
      throw new Error("Vínculo ministerial encerrado não pode ter o cargo alterado.");
    }
    if (membership.ministry.status === "ARCHIVED") {
      throw new Error("Ministério arquivado não aceita novas operações.");
    }
    if (effectiveDate.getTime() < normalizeDateOnly(membership.startDate).getTime()) {
      throw new Error("Data efetiva do cargo não pode ser anterior ao início do vínculo.");
    }

    const updated = await transaction.ministryMembership.update({
      where: { id: membershipId },
      data: { role },
    });
    await recordTimelineEvent(transaction, {
      personId: membership.personId,
      actorId: actor.id,
      category: "MINISTRY",
      title: "Cargo no Ministério alterado",
      description: `${membership.person.fullName} · ${membership.ministry.name} · ${membership.role === "LEADER" ? "Líder" : "Membro"} → ${role === "LEADER" ? "Líder" : "Membro"} · Efeito em ${formatDateOnly(effectiveDate)}`,
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
  }));
}

export async function endMembership(
  actor: MembershipActor,
  membershipId: string,
  input: EndMembershipInput,
) {
  assertCanManageMemberships(actor);
  const endDate = normalizeEffectiveDate(input.endDate, "Data de saída");

  return withConflictMessage(() => withSerializableTransaction(async (transaction) => {
    await assertActiveAdministrator(transaction, actor);
    const membership = await getMembershipContext(transaction, membershipId);
    if (membership.endDate) {
      throw new Error("Vínculo ministerial já está encerrado.");
    }
    if (endDate.getTime() < normalizeDateOnly(membership.startDate).getTime()) {
      throw new Error("Data de saída não pode ser anterior ao início do vínculo.");
    }

    const updated = await transaction.ministryMembership.update({
      where: { id: membershipId },
      data: { endDate },
    });
    await recordTimelineEvent(transaction, {
      personId: membership.personId,
      actorId: actor.id,
      category: "MINISTRY",
      title: "Vínculo ministerial encerrado",
      description: `${membership.person.fullName} · ${membership.ministry.name} · ${membership.role === "LEADER" ? "Líder" : "Membro"} · Entrada: ${formatDateOnly(membership.startDate)} · Saída: ${formatDateOnly(endDate)}`,
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
  }));
}
