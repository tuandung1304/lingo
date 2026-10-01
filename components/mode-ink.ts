import type { Mode } from '@/lib/assist/schema'

// One pen per mode, shared by tabs, badges and the margin rule so a colour always means the same mode
export const MODE_INK: Record<
  Mode,
  { text: string; badge: string; rule: string }
> = {
  fix: {
    text: 'text-ink-fix',
    badge: 'bg-ink-fix/10 text-ink-fix',
    rule: 'border-l-ink-fix/70',
  },
  suggest: {
    text: 'text-ink-suggest',
    badge: 'bg-ink-suggest/10 text-ink-suggest',
    rule: 'border-l-ink-suggest/70',
  },
  write: {
    text: 'text-ink-write',
    badge: 'bg-ink-write/10 text-ink-write',
    rule: 'border-l-ink-write/70',
  },
}
