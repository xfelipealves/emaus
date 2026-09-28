import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardError, { DashboardErrorFallback, logProtectedPageError } from "./error";

afterEach(() => {
  vi.restoreAllMocks();
});

function findRetryButton(children: ReactNode): ReactElement<{ onClick?: () => void }> | undefined {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) continue;
    if (child.type === "button") return child as ReactElement<{ onClick?: () => void }>;

    const nestedButton = findRetryButton(child.props.children);
    if (nestedButton) return nestedButton;
  }

  return undefined;
}

describe("protected dashboard error boundary", () => {
  it("shows a safe fallback without exposing the thrown message", () => {
    const error = new Error("PRIVATE_DATABASE_ROW_SENTINEL");
    const html = renderToStaticMarkup(<DashboardError error={error} reset={() => undefined} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("Não foi possível carregar esta página");
    expect(html).toContain("O conteúdo não está disponível agora. Tente novamente.");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain(error.message);
  });

  it("connects the retry button to the segment reset callback", () => {
    const reset = vi.fn();
    const fallback = DashboardErrorFallback({ reset });
    const retryButton = findRetryButton(fallback.props.children);

    expect(retryButton).toBeDefined();
    expect(retryButton?.props.onClick).toBe(reset);
  });

  it("logs dashboard scope and the Next.js digest without private details outside development", () => {
    const error = Object.assign(new Error("PRIVATE_DATABASE_ROW_SENTINEL"), { digest: "next-digest-42" });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logProtectedPageError(error);

    expect(log).toHaveBeenCalledWith("[Emaús] protected page render failed", {
      scope: "dashboard",
      digest: "next-digest-42",
    });
  });
});
