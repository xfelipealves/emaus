import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ id, label, error, className = "", ...props }: InputProps) {
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
      <span className="mb-2 block">{label}</span>
      <input
        {...props}
        id={id}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className={`min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-950 outline-none transition focus:border-[#477462] focus:ring-2 focus:ring-[#dcebe3] ${error ? "border-red-500" : ""} ${className}`}
      />
      {error ? <span className="mt-1 block text-xs font-normal text-red-700" id={errorId}>{error}</span> : null}
    </label>
  );
}
