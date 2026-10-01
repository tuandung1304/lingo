import { cn } from 'cn'

// A handwritten L in mực tím, the same stroke as the favicon
export const LOGO_STROKE =
  'M10.5 6.5C10.6 12 10.2 17.5 9.6 24.2C14 23.2 19 23.4 24 23.6'

export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-ink-suggest text-background inline-flex size-7 items-center justify-center rounded-lg',
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-full">
        <path
          d={LOGO_STROKE}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
