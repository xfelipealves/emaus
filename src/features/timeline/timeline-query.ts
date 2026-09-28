import type { AccountRole, TimelineEventCategory } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type TimelineFilter = "all" | "status" | "ministries" | "attendance" | "notes" | "corrections";

export type TimelineActor = {
  id: string;
  role: AccountRole;
};

export type TimelineEventItem = {
  id: string;
  personId: string;
  category: TimelineEventCategory;
  title: string;
  description: string | null;
  occurredAt: Date;
  actor: { id: string; fullName: string } | null;
};

const categoryMap: Record<Exclude<TimelineFilter, "all">, TimelineEventCategory[]> = {
  status: ["STATUS", "REGISTRATION"],
  ministries: ["MINISTRY"],
  attendance: ["ATTENDANCE"],
  notes: ["NOTE"],
  corrections: ["CORRECTION"],
};

export async function getPersonTimeline(
  actor: TimelineActor,
  personId: string,
  filter: TimelineFilter = "all",
): Promise<TimelineEventItem[]> {
  const account = await prisma.account.findUnique({
    where: { id: actor.id },
    select: {
      role: true,
      status: true,
      ministryAccess: { where: { revokedAt: null }, select: { ministryId: true } },
    },
  });
  if (!account || account.status !== "ACTIVE" || account.role !== actor.role) return [];

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { memberships: { select: { ministryId: true } } },
  });
  if (!person) return [];

  if (
    account.role === "LEADER" &&
    !person.memberships.some(({ ministryId }) => account.ministryAccess.some((access) => access.ministryId === ministryId))
  ) {
    return [];
  }

  const events = await prisma.timelineEvent.findMany({
    where: {
      personId,
      ...(filter === "all" ? {} : { category: { in: categoryMap[filter] } }),
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      personId: true,
      category: true,
      title: true,
      description: true,
      occurredAt: true,
      actor: { select: { id: true, person: { select: { fullName: true } } } },
    },
  });

  return events.map((event) => ({
    ...event,
    actor: event.actor ? { id: event.actor.id, fullName: event.actor.person.fullName } : null,
  }));
}
