import type { Prisma } from "@prisma/client";

export type TimelineEventInput = {
  personId: string;
  actorId?: string;
  category: Prisma.TimelineEventCreateInput["category"];
  title: string;
  description?: string;
  occurredAt?: Date;
};

export type AuditEventInput = {
  actorId: string;
  targetType: string;
  targetId: string;
  action: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
};

export function recordTimelineEvent(
  transaction: Prisma.TransactionClient,
  input: TimelineEventInput,
) {
  return transaction.timelineEvent.create({
    data: { ...input, occurredAt: input.occurredAt ?? new Date() },
  });
}

export function recordAuditEvent(
  transaction: Prisma.TransactionClient,
  input: AuditEventInput,
) {
  return transaction.auditEvent.create({ data: input });
}
