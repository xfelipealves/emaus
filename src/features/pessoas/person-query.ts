import type { AccountRole, PersonStatus } from "@prisma/client";
import { calculateAge } from "../../lib/dates";
import { prisma } from "../../lib/prisma";

export type PersonListFilter = "all" | "visitor" | "member" | "inactive";

export type PersonListOptions = {
  search?: string;
  status?: PersonListFilter;
  now?: Date;
};

export type PersonListItem = {
  id: string;
  fullName: string;
  status: PersonStatus;
  phone: string | null;
  birthDate: Date | null;
  age: number | null;
};

type PersonQueryActor = {
  id: string;
  role: AccountRole;
};

const statusMap: Record<Exclude<PersonListFilter, "all">, PersonStatus> = {
  visitor: "VISITOR",
  member: "MEMBER",
  inactive: "INACTIVE",
};

export async function searchPeople(
  actor: PersonQueryActor,
  options: PersonListOptions = {},
): Promise<PersonListItem[]> {
  const account = await prisma.account.findUnique({
    where: { id: actor.id },
    select: {
      role: true,
      status: true,
      ministryAccess: {
        where: { revokedAt: null },
        select: { ministryId: true },
      },
    },
  });

  if (!account || account.status !== "ACTIVE" || account.role !== actor.role) {
    throw new Error("Você não tem permissão para consultar Pessoas.");
  }

  const search = options.search?.trim();
  const status = options.status && options.status !== "all"
    ? statusMap[options.status]
    : undefined;
  const ministryIds = account.ministryAccess.map((access) => access.ministryId);

  const people = await prisma.person.findMany({
    where: {
      ...(search ? { fullName: { contains: search, mode: "insensitive" } } : {}),
      ...(status ? { status } : {}),
      ...(account.role === "LEADER"
        ? { memberships: { some: { ministryId: { in: ministryIds } } } }
        : {}),
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      status: true,
      phone: true,
      birthDate: true,
    },
  });

  return people.map((person) => ({
    ...person,
    age: calculateAge(person.birthDate, options.now),
  }));
}
