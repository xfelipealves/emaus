import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAllowsAuthPath, isDemoMode } from "./demo";

afterEach(() => vi.unstubAllEnvs());

describe("public demonstration account protection", () => {
  it.each([undefined, "false", "1"])("does not change normal installations (%s)", (value) => {
    vi.stubEnv("EMAUS_DEMO_MODE", value);
    expect(isDemoMode()).toBe(false);
    expect(demoAllowsAuthPath("/change-password")).toBe(true);
    expect(demoAllowsAuthPath("/update-user")).toBe(true);
  });

  it.each(["/sign-in/username", "/sign-in/email", "/sign-out", "/get-session", "/list-sessions"])("keeps demo login/session access working: %s", (path) => {
    vi.stubEnv("EMAUS_DEMO_MODE", "true");
    expect(demoAllowsAuthPath(path)).toBe(true);
  });

  it.each(["/change-password", "/set-password", "/update-user", "/change-email", "/delete-user", "/sign-up/email", "/reset-password", "/revoke-sessions", "/unknown-future-endpoint"])("prevents demo visitors changing shared accounts: %s", (path) => {
    vi.stubEnv("EMAUS_DEMO_MODE", "true");
    expect(demoAllowsAuthPath(path)).toBe(false);
  });
});
