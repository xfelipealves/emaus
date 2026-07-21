type ToastProps = {
  message: string;
  kind?: "success" | "error";
};

export function Toast({ message, kind = "success" }: ToastProps) {
  return (
    <div aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${kind === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-[#b9d9c9] bg-[#f0f4ef] text-[#184d3c]"}`} role="status">
      {message}
    </div>
  );
}
