import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("./actions", () => ({ loginAction: vi.fn() }));

describe("login page recovery entry", () => {
  it("links people who forgot their password to the recovery form", () => {
    const markup = renderToStaticMarkup(<LoginPage />);

    expect(markup).toContain('href="/login/recuperar"');
    expect(markup).toContain("Esqueceu a senha?");
  });
});
