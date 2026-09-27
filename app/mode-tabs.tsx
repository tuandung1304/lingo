'use client'

import { cn } from 'cn'

import { type Mode, MODE_LABELS, MODES } from '@/lib/assist/schema'

export function ModeTabs({
  value,
  onChange,
}: {
  value: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Mode"
      className="-mx-4 flex scrollbar-none gap-1 overflow-x-auto px-4"
    >
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={m === value}
          onClick={() => onChange(m)}
          className={cn(
            'text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            'hover:text-foreground hover:bg-muted/60',
            'aria-selected:bg-foreground aria-selected:text-background aria-selected:hover:bg-foreground',
          )}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  )
}
