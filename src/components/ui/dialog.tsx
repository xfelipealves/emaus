import type { ReactNode } from "react";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function Dialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  children,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-[rgb(21_79_67_/_0.38)] p-5 backdrop-blur-sm" role="presentation">
      <section
        aria-describedby={description ? "dialog-description" : undefined}
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-panel)]"
        role="dialog"
      >
        <h2 id="dialog-title" className="text-lg font-semibold tracking-[-0.035em] text-[var(--ink)]">
          {title}
        </h2>
        {description ? (
          <p id="dialog-description" className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
