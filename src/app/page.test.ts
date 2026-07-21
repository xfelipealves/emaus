import { describe, expect, it } from "vitest";
import { homePageTitle } from "./page";

describe("home page foundation", () => {
  it("exposes the Emaús product title", () => {
    expect(homePageTitle).toBe("Emaús");
  });
});
