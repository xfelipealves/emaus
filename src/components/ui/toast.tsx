import type { ReactNode } from "react";

type ToastProps = {
  children: ReactNode;
  tone?: "success" | "error" | "info";
};

const toneClasses = {
  success: "border-[#b9ded5] bg-[#effaf7] text-[#155e58]",
  error: "border-[#ecc3c3] bg-[#fff5f5] text-[#963b3b]",
  info: "border-slate-200 bg-white text-slate-700",
};

export function Toast({ children, tone = "success" }: ToastProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses[tone]}`} role="status">
      {children}
    </div>
  );
}
