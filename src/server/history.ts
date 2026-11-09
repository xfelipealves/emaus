import "server-only";
import { db, schema, type Tx } from "@/db";
import type { TIMELINE_KINDS } from "@/db/schema";

type Executor = typeof db | Tx;

export async function recordTimeline(
  exec: Executor,
  entry: {
    personId: string;
    actorId?: string | null;
    kind: (typeof TIMELINE_KINDS)[number];
    title: string;
    detail?: string | null;
    occurredAt?: Date;
  },
) {
  await exec.insert(schema.timelineEvent).values(entry);
}

export async function recordAudit(
  exec: Executor,
  entry: {
    actorId: string | null;
    entity: string;
    entityId: string;
    action: string;
    summary: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await exec.insert(schema.auditLog).values(entry);
}
