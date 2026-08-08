import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { validateLoginInput } from "../../lib/validations/auth";

describe("password authentication", () => {
  it("hashes a password without returning the plain value", async () => {
    const password = "correct horse battery staple";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("verifies the correct password and rejects a wrong password", async () => {
    const passwordHash = await hashPassword("correct password");

    await expect(verifyPassword(passwordHash, "correct password")).resolves.toBe(
      true,
    );
    await expect(verifyPassword(passwordHash, "wrong password")).resolves.toBe(
      false,
    );
  });

  it("rejects blank username and password fields", () => {
    const result = validateLoginInput({ username: " ", password: "" });

    expect(result).toEqual({
      success: false,
      errors: {
        username: "Nome de usuário é obrigatório",
        password: "Senha é obrigatória",
      },
    });
  });
});
