import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";
import { validateLoginInput } from "../../lib/validations/auth";

describe("password authentication primitives", () => {
  it("hashes a password without returning or persisting the plain value", async () => {
    const plainPassword = "uma-senha-segura";

    const passwordHash = await hashPassword(plainPassword);

    expect(passwordHash).not.toBe(plainPassword);
    expect(passwordHash).not.toContain(plainPassword);
    expect(await verifyPassword(passwordHash, plainPassword)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword("uma-senha-segura");

    expect(await verifyPassword(passwordHash, "senha-incorreta")).toBe(false);
  });

  it("rejects blank username and password fields", () => {
    expect(validateLoginInput({ username: "", password: "" })).toEqual({
      success: false,
      errors: {
        username: "Informe o nome de usuário.",
        password: "Informe a senha.",
      },
    });
  });
});
