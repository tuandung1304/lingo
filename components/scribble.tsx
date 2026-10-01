import { cn } from 'cn'

// A pen stroke drawn under the chosen item; it draws itself in when it mounts
export function Scribble({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className={cn('pointer-events-none h-2 overflow-visible', className)}
    >
      <path
        d="M2 5.2C18 3 33 6.4 50 4.6S83 2.6 98 4.4"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="animate-draw"
      />
    </svg>
  )
}
