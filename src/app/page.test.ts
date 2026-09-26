import { describe, expect, it } from "vitest";
import { APP_NAME } from "./app-identity";

describe("Emaús application bootstrap", () => {
  it("defines the application identity", () => {
    expect(APP_NAME).toBe("Emaús");
  });
});
