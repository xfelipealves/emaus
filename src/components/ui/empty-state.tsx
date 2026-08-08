import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-5">{action}</div>
    </section>
  );
}
