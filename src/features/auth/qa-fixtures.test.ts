import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD as fixturePassword } from "../../../e2e/demo-fixtures";
import { DEMO_PASSWORD as seedPassword, DEMO_PASSWORD_HASH } from "../../../prisma/seed";
import { verifyPassword } from "./password";

describe("QA account fixtures", () => {
  it("keeps the browser fixture compatible with the seeded account hash", async () => {
    expect(fixturePassword).toBe(seedPassword);
    await expect(verifyPassword(DEMO_PASSWORD_HASH, fixturePassword)).resolves.toBe(true);
  });
});
