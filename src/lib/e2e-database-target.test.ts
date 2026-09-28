import { describe, expect, it } from "vitest";
import { assertDedicatedE2EDatabase } from "./e2e-database-target";

describe("assertDedicatedE2EDatabase", () => {
  it("requires DATABASE_URL in the Playwright process", () => {
    expect(() => assertDedicatedE2EDatabase(undefined)).toThrow(/set DATABASE_URL explicitly/);
  });

  it("rejects the default application database", () => {
    expect(() => assertDedicatedE2EDatabase("postgresql://localhost:5433/emaus"))
      .toThrow(/emaus_e2e_\*/);
  });

  it("accepts an explicitly supplied disposable E2E database URL", () => {
    expect(assertDedicatedE2EDatabase("postgresql://localhost:5433/emaus_e2e_secretary?schema=public"))
      .toBe("emaus_e2e_secretary");
  });
});
