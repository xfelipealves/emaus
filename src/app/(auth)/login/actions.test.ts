import { describe, expect, it } from "vitest";
import { requestPasswordRecoveryAction } from "./actions";

function request(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return requestPasswordRecoveryAction({}, formData);
}

describe("password recovery response", () => {
  it("does not distinguish an existing account email from an unknown one", async () => {
    const registered = await request("known@example.test");
    const unknown = await request("unknown@example.test");

    expect(registered).toEqual(unknown);
    expect(registered.message).toContain("peça a um administrador");
  });
});
