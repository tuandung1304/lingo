'use client'

import { cn } from 'cn'

import { MODE_INK } from '@/components/mode-ink'
import { Scribble } from '@/components/scribble'
import { type Mode, MODE_LABELS, MODES } from '@/lib/assist/schema'

export function ModeTabs({
  value,
  onChange,
}: {
  value: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <div role="tablist" aria-label="Mode" className="-ml-2 flex gap-1">
      {MODES.map((m) => {
        const selected = m === value
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(m)}
            className={cn(
              'focus-visible:ring-ring/50 font-hand relative rounded-md px-2 pt-0.5 pb-2.5 text-[1.7rem] leading-none font-semibold transition-colors outline-none focus-visible:ring-3',
              selected
                ? MODE_INK[m].text
                : 'text-muted-foreground/80 hover:text-foreground',
            )}
          >
            {MODE_LABELS[m]}
            {selected && (
              <Scribble className="absolute inset-x-1.5 bottom-0.5 w-[calc(100%-0.75rem)]" />
            )}
          </button>
        )
      })}
    </div>
  )
}
