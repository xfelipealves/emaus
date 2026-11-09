import { cn } from "@/lib/utils";

/** Marca: dois caminhantes na estrada ao entardecer (sol + caminho). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <circle cx="16" cy="13" r="5" fill="var(--primary-foreground)" opacity="0.95" />
      <path d="M4 24c5-3 9-4.5 12-4.5S23 21 28 24" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M8 28.5c3.5-2.5 5.5-3.5 8-3.5s4.5 1 8 3.5" stroke="var(--primary-foreground)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
    </svg>
  );
}

export function Logo({ churchName, className }: { churchName?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="min-w-0 leading-tight">
        <div className="font-display text-xl">Emaús</div>
        {churchName && <div className="truncate text-[11px] text-muted-foreground">{churchName}</div>}
      </div>
    </div>
  );
}
