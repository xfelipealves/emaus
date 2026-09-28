import { describe, expect, it, vi } from "vitest";
import { Button, Dialog, EmptyState, ErrorMessage, Input, Toast } from "./index";

describe("shared UI primitives", () => {
  it("provides button variants and preserves native button props", () => {
    const button = Button({ disabled: true, variant: "danger", children: "Inativar" });

    expect(button.props.type).toBeUndefined();
    expect(button.props.disabled).toBe(true);
    expect(button.props.children).toBe("Inativar");
    expect(button.props.className).toContain("button-danger");
  });

  it("associates an input label and contextual error", () => {
    const input = Input({ id: "telefone", label: "Telefone", error: "Informe o telefone" });
    const [label, field, error] = input.props.children;

    expect(input.props.htmlFor).toBe("telefone");
    expect(label.props.children).toBe("Telefone");
    expect(field.props["aria-invalid"]).toBe(true);
    expect(field.props["aria-describedby"]).toBe("telefone-error");
    expect(error.props.children).toBe("Informe o telefone");
  });

  it("renders an explicit confirm and cancel dialog", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const dialog = Dialog({
      open: true,
      title: "Arquivar nota",
      description: "A nota ficará oculta por padrão.",
      confirmLabel: "Arquivar",
      cancelLabel: "Voltar",
      onConfirm,
      onCancel,
    })!;
    const section = dialog.props.children;
    const actions = section.props.children[3];
    const [cancel, confirm] = actions.props.children;

    expect(section.props.role).toBe("dialog");
    expect(section.props["aria-modal"]).toBe("true");
    expect(cancel.props.children).toBe("Voltar");
    expect(cancel.props.onClick).toBe(onCancel);
    expect(confirm.props.children).toBe("Arquivar");
    expect(confirm.props.onClick).toBe(onConfirm);
  });

  it("keeps a closed dialog out of the rendered tree", () => {
    expect(
      Dialog({ open: false, title: "Confirmar", onConfirm: vi.fn(), onCancel: vi.fn() }),
    ).toBeNull();
  });

  it("offers one primary action in an empty state", () => {
    const action = Button({ children: "Cadastrar pessoa" });
    const state = EmptyState({
      title: "Nenhuma pessoa encontrada",
      description: "Comece cadastrando uma pessoa.",
      action,
    });

    expect(state.props.children[2].props.children).toBe(action);
  });

  it("exposes feedback with status and alert semantics", () => {
    const toast = Toast({ children: "Pessoa salva", tone: "success" });
    const error = ErrorMessage({ children: "Não foi possível salvar" });

    expect(toast.props.role).toBe("status");
    expect(toast.props.children).toBe("Pessoa salva");
    expect(error.props.role).toBe("alert");
    expect(error.props.children).toBe("Não foi possível salvar");
  });
});
