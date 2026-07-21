import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      <Link className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#184d3c] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#123b2e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#184d3c]" href={actionHref}>{actionLabel}</Link>
    </section>
  );
}
