import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RecoveryPage from "./page";

vi.mock("../actions", () => ({ requestPasswordRecoveryAction: vi.fn() }));

describe("password recovery page", () => {
  it("offers an email recovery request and a route back to login", () => {
    const markup = renderToStaticMarkup(<RecoveryPage />);

    expect(markup).toContain("Recuperação de senha");
    expect(markup).toContain('name="email"');
    expect(markup).toContain("Solicitar recuperação");
    expect(markup).toContain('href="/login"');
  });
});
