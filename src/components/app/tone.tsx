import { cn } from "@/lib/utils";
import { type Tone, toneFor } from "@/lib/labels";
import { initials } from "@/lib/text";

export function ToneDot({ tone, className }: { tone: string; className?: string }) {
  return <span data-tone={tone} className={cn("inline-block size-2 shrink-0 rounded-full bg-tone", className)} />;
}

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full bg-tone/12 px-2 text-xs font-medium whitespace-nowrap text-tone",
        className,
      )}
    >
      {children}
    </span>
  );
}

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-20 text-2xl",
} as const;

export function PersonAvatar({
  name,
  seed,
  size = "sm",
  tone,
  className,
}: {
  name: string;
  seed?: string;
  size?: keyof typeof SIZES;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      data-tone={tone ?? toneFor(seed ?? name)}
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-tone/15 font-semibold tracking-tight text-tone ring-1 ring-tone/20 select-none",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
