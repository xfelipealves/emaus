import type { ReactNode } from "react";

type ToastProps = {
  children: ReactNode;
  tone?: "success" | "error" | "info";
};

const toneClasses = {
  success: "border-[var(--line-strong)] bg-[var(--brand-soft)] text-[var(--brand-deep)]",
  error: "border-[#f0c9c4] bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)]",
};

export function Toast({ children, tone = "success" }: ToastProps) {
  return (
    <div className={`status-message border px-4 py-3 text-sm ${toneClasses[tone]}`} role="status">
      {children}
    </div>
  );
}
