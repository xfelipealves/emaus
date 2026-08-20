import { describe, expect, it } from "vitest";
import { projectEligiblePersonIds } from "./attendance-service";

describe("attendance eligibility projection", () => {
  const memberships = [
    { personId: "person-a", ministryId: "ministry-a" },
    { personId: "person-a", ministryId: "ministry-b" },
    { personId: "person-b", ministryId: "ministry-b" },
    { personId: "person-c", ministryId: "ministry-c" },
  ];

  it("includes each person once for a whole-church audience", () => {
    expect(projectEligiblePersonIds(memberships, [])).toEqual(["person-a", "person-b", "person-c"]);
  });

  it("limits eligibility to the selected ministry audience", () => {
    expect(projectEligiblePersonIds(memberships, ["ministry-b"])).toEqual(["person-a", "person-b"]);
  });
});
