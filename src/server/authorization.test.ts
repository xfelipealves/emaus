import { describe, expect, it } from "vitest";
import {
  canAccessPerson,
  canAccessMinistry,
  canManageAccounts,
  canManageMeeting,
  canManageMinistry,
  canManagePeople,
  type AuthorizationAccount,
} from "./authorization";

function account(
  role: AuthorizationAccount["role"],
  ministryAccess: AuthorizationAccount["ministryAccess"] = [],
): AuthorizationAccount {
  return { role, ministryAccess };
}

describe("role and ministry authorization", () => {
  it("gives an administrator full MVP access", () => {
    const administrator = account("ADMINISTRATOR");

    expect(canManagePeople(administrator)).toBe(true);
    expect(canManageMinistry(administrator)).toBe(true);
    expect(canManageAccounts(administrator)).toBe(true);
    expect(canAccessPerson(administrator, [])).toBe(true);
    expect(canManageMeeting(administrator, [])).toBe(true);
  });

  it("allows a secretary to manage people and meetings but not ministries or accounts", () => {
    const secretary = account("SECRETARY");

    expect(canManagePeople(secretary)).toBe(true);
    expect(canManageMeeting(secretary, ["ministry-1"])).toBe(true);
    expect(canManageMinistry(secretary)).toBe(false);
    expect(canManageAccounts(secretary)).toBe(false);
  });

  it("restricts a leader to active explicit ministry scopes", () => {
    const leader = account("LEADER", [
      { ministryId: "authorized", revokedAt: null },
      { ministryId: "revoked", revokedAt: new Date("2026-01-01") },
    ]);

    expect(canManagePeople(leader)).toBe(false);
    expect(canManageMinistry(leader)).toBe(false);
    expect(canManageAccounts(leader)).toBe(false);
    expect(canAccessPerson(leader, ["historical", "authorized"])).toBe(true);
    expect(canAccessPerson(leader, ["unrelated", "revoked"])).toBe(false);
    expect(canManageMeeting(leader, ["authorized"])).toBe(true);
    expect(canManageMeeting(leader, ["authorized", "unrelated"])).toBe(false);
    expect(canManageMeeting(leader, [])).toBe(false);
  });

  it("does not infer a leader scope from membership or revoked access", () => {
    const leader = account("LEADER", [
      { ministryId: "revoked", revokedAt: new Date("2026-01-01") },
    ]);

    expect(canAccessMinistry(leader, "revoked")).toBe(false);
    expect(canAccessPerson(leader, ["revoked"])).toBe(false);
  });
});
