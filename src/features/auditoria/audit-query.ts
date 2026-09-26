import type { AccountRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type AuditQueryActor = {
  id: string;
  role: AccountRole;
};

function assertAdministrator(actor: AuditQueryActor) {
  if (actor.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem consultar a auditoria.");
  }
}

export async function listAuditEvents(actor: AuditQueryActor) {
  assertAdministrator(actor);

  const account = await prisma.account.findUnique({
    where: { id: actor.id },
    select: { role: true, status: true },
  });
  if (!account || account.status !== "ACTIVE" || account.role !== "ADMINISTRATOR") {
    throw new Error("Apenas administradores podem consultar a auditoria.");
  }

  return prisma.auditEvent.findMany({
    include: { actor: { include: { person: { select: { fullName: true } } } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}
