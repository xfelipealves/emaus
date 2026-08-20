import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

export function withTransaction<T>(
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(work);
}
