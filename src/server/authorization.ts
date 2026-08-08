import type { AccountMinistryAccess, AccountRole } from "@prisma/client";

export type AuthorizationAccount = Pick<{ role: AccountRole }, "role"> & {
  ministryAccess: ReadonlyArray<
    Pick<AccountMinistryAccess, "ministryId" | "revokedAt">
  >;
};

export function canManagePeople(account: AuthorizationAccount): boolean {
  return account.role === "ADMINISTRATOR" || account.role === "SECRETARY";
}

export function canManageMinistry(account: AuthorizationAccount): boolean {
  return account.role === "ADMINISTRATOR";
}

export function canManageAccounts(account: AuthorizationAccount): boolean {
  return account.role === "ADMINISTRATOR";
}

export function canAccessMinistry(
  account: AuthorizationAccount,
  ministryId: string,
): boolean {
  if (account.role === "ADMINISTRATOR" || account.role === "SECRETARY") {
    return true;
  }

  return account.ministryAccess.some(
    (access) => access.ministryId === ministryId && access.revokedAt === null,
  );
}

export function canAccessPerson(
  account: AuthorizationAccount,
  personMinistryIds: readonly string[],
): boolean {
  if (account.role !== "LEADER") {
    return account.role === "ADMINISTRATOR" || account.role === "SECRETARY";
  }

  return personMinistryIds.some((ministryId) =>
    canAccessMinistry(account, ministryId),
  );
}

export function canManageMeeting(
  account: AuthorizationAccount,
  audienceMinistryIds: readonly string[],
): boolean {
  if (account.role === "ADMINISTRATOR" || account.role === "SECRETARY") {
    return true;
  }

  return (
    audienceMinistryIds.length > 0 &&
    audienceMinistryIds.every((ministryId) =>
      canAccessMinistry(account, ministryId),
    )
  );
}
