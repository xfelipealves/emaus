import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ id, label, error, className = "", ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replaceAll(" ", "-");
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--ink-soft)]" htmlFor={inputId}>
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={`field-control min-h-11 w-full text-sm ${error ? "border-[var(--danger)]" : ""} ${className}`}
      />
      {error ? (
        <span id={errorId} className="text-xs font-normal text-[var(--danger)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}
