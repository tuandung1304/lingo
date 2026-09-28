import { cn } from 'cn'
import { Languages } from 'lucide-react'

export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-linear-to-br from-primary to-primary/70 text-primary-foreground inline-flex size-7 items-center justify-center rounded-lg shadow-sm',
        className,
      )}
    >
      <Languages className="h-[58%] w-[58%]" strokeWidth={2.25} />
    </span>
  )
}
