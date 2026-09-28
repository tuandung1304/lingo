import { cn } from 'cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold tracking-tight shadow-sm',
        className,
      )}
    >
      Ea
    </span>
  )
}
