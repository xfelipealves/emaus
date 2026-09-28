import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="empty-panel px-6 py-10">
      <h2 className="text-base font-semibold text-[var(--ink)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--ink-soft)]">{description}</p>
      <div className="mt-5">{action}</div>
    </section>
  );
}
