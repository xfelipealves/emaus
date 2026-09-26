import type { ReactNode } from "react";

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#ecc3c3] bg-[#fff5f5] px-4 py-3 text-sm text-[#963b3b]" role="alert">
      {children}
    </div>
  );
}
