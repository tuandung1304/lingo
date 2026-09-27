import 'server-only'
import type { Tone } from '@/lib/assist/schema'

export const TONE_GUIDE: Record<Tone, string> = {
  casual:
    'casual chat with friends on Discord: contractions, simple words, relaxed',
  neutral: 'neutral everyday English, neither slangy nor formal',
  polite: 'polite and friendly, suitable for strangers or a work call',
}
