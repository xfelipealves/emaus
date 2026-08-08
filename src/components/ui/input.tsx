import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ id, label, error, className = "", ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replaceAll(" ", "-");
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700" htmlFor={inputId}>
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={`min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-[#26766d] focus:ring-2 focus:ring-[#dceee9] ${error ? "border-[#b54747]" : ""} ${className}`}
      />
      {error ? (
        <span id={errorId} className="text-xs font-normal text-[#b54747]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
