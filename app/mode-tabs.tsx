'use client'

import { cn } from 'cn'

// Order is the Tab-cycling order once more modes exist. `ready: false` shows the
// tab disabled until its prompt and schema land in lib/ai/modes/*.
export const MODES = [
  { id: 'fix', label: 'Fix', ready: true },
  { id: 'keywords', label: 'Keywords', ready: false },
  { id: 'describe', label: 'Describe', ready: false },
  { id: 'reply', label: 'Reply', ready: false },
  { id: 'try-first', label: 'Try first', ready: false },
] as const
export type ModeId = (typeof MODES)[number]['id']

export function ModeTabs({
  value,
  onChange,
}: {
  value: ModeId
  onChange: (mode: ModeId) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Mode"
      className="-mx-4 flex scrollbar-none gap-1 overflow-x-auto px-4"
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={m.id === value}
          disabled={!m.ready}
          title={m.ready ? undefined : 'Coming soon'}
          onClick={() => onChange(m.id)}
          className={cn(
            'text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            'hover:text-foreground hover:bg-muted/60',
            'aria-selected:bg-foreground aria-selected:text-background aria-selected:hover:bg-foreground',
            'disabled:hover:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
          )}
        >
          {m.label}
          {!m.ready && (
            <span className="text-[10px] font-normal tracking-wide uppercase">
              soon
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
