import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { EmptyState } from "./empty-state";
import { ErrorMessage } from "./error-message";
import { Input } from "./input";
import { Toast } from "./toast";

describe("shared UI primitives", () => {
  it("renders a primary button with its accessible label", () => {
    const markup = renderToStaticMarkup(createElement(Button, null, "Salvar pessoa"));

    expect(markup).toContain('type="button"');
    expect(markup).toContain("Salvar pessoa");
    expect(markup).toContain("bg-[#184d3c]");
  });

  it("associates an input label and error with the field", () => {
    const markup = renderToStaticMarkup(createElement(Input, { id: "full-name", label: "Nome completo", error: "Informe o nome" }));

    expect(markup).toContain('for="full-name"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="full-name-error"');
    expect(markup).toContain("Informe o nome");
  });

  it("renders explicit confirm and cancel actions in a dialog", () => {
    const markup = renderToStaticMarkup(
      createElement(Dialog, {
        open: true,
        title: "Inativar pessoa",
        description: "O histórico será preservado.",
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Confirmar");
    expect(markup).toContain("Cancelar");
  });

  it("does not render a closed dialog", () => {
    const markup = renderToStaticMarkup(createElement(Dialog, { open: false, title: "Oculto", onConfirm: vi.fn(), onCancel: vi.fn() }));

    expect(markup).toBe("");
  });

  it("offers one primary action in an empty state", () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "Nenhuma pessoa",
        description: "Comece cadastrando um visitante.",
        actionLabel: "Cadastrar pessoa",
        actionHref: "/pessoas/nova",
      }),
    );

    expect(markup).toContain("Nenhuma pessoa");
    expect(markup).toContain('href="/pessoas/nova"');
    expect(markup).toContain("Cadastrar pessoa");
    expect(markup.match(/Cadastrar pessoa/g)).toHaveLength(1);
  });

  it("uses status semantics for toast and error feedback", () => {
    const toastMarkup = renderToStaticMarkup(createElement(Toast, { message: "Pessoa salva" }));
    const errorMarkup = renderToStaticMarkup(createElement(ErrorMessage, { message: "Não foi possível salvar" }));

    expect(toastMarkup).toContain('role="status"');
    expect(toastMarkup).toContain("Pessoa salva");
    expect(errorMarkup).toContain('role="alert"');
    expect(errorMarkup).toContain("Não foi possível salvar");
  });
});
