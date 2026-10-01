import type { Mode } from '@/lib/assist/schema'

// One pen per mode, shared by tabs, badges, buttons and the margin rule so a colour always means the same mode
export const MODE_INK: Record<
  Mode,
  { text: string; badge: string; margin: string; button: string }
> = {
  fix: {
    text: 'text-ink-fix',
    badge: 'bg-ink-fix/10 text-ink-fix',
    margin: 'bg-ink-fix/45',
    button: 'bg-ink-fix text-background hover:bg-ink-fix/85',
  },
  suggest: {
    text: 'text-ink-suggest',
    badge: 'bg-ink-suggest/10 text-ink-suggest',
    margin: 'bg-ink-suggest/45',
    button: 'bg-ink-suggest text-background hover:bg-ink-suggest/85',
  },
  write: {
    text: 'text-ink-write',
    badge: 'bg-ink-write/10 text-ink-write',
    margin: 'bg-ink-write/45',
    button: 'bg-ink-write text-background hover:bg-ink-write/85',
  },
}
