import { cn } from 'cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold tracking-tight',
        className,
      )}
    >
      Ea
    </span>
  )
}
