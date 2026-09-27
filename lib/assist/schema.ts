import { z } from 'zod'

// Shared by the /api/assist route and the client (useObject)

// Order is the Tab-cycling order on the Assist page
export const MODES = ['fix', 'suggest'] as const
export type Mode = (typeof MODES)[number]
export const MODE_LABELS: Record<Mode, string> = {
  fix: 'Fix',
  suggest: 'Suggest',
}

export const TONES = ['casual', 'neutral', 'polite'] as const
export type Tone = (typeof TONES)[number]

export const EDIT_TYPES = [
  'spelling',
  'grammar',
  'word_choice',
  'naturalness',
] as const
export type EditType = (typeof EDIT_TYPES)[number]

export const assistRequestSchema = z.object({
  mode: z.enum(MODES),
  input: z.string().trim().min(1).max(1000),
  tone: z.enum(TONES),
  // Skip the cache and ask the model again; the new answer replaces the cached one
  fresh: z.boolean().optional(),
})
export type AssistRequest = z.infer<typeof assistRequestSchema>

// `corrected` comes first so it streams in before everything else
export const fixResultSchema = z.object({
  corrected: z
    .string()
    .describe('The corrected sentence. Same meaning, same language register.'),
  alternatives: z
    .array(z.string())
    .describe('At most 2 more natural ways to say it, in the requested tone.'),
  edits: z
    .array(
      z.object({
        original: z
          .string()
          .describe(
            'Exact text from the input that was changed. Empty if inserted.',
          ),
        replacement: z
          .string()
          .describe(
            'Exact text in `corrected` that replaces it. Empty if removed.',
          ),
        type: z.enum(EDIT_TYPES),
        explanation: z
          .string()
          .describe('One short sentence in Vietnamese explaining why.'),
      }),
    )
    .describe('One entry per change between the input and `corrected`.'),
})
export type FixResult = z.infer<typeof fixResultSchema>
export type FixEdit = FixResult['edits'][number]

// `suggestions` comes first so the sentences stream in before the vocab notes
export const suggestResultSchema = z.object({
  suggestions: z
    .array(z.string())
    .describe(
      '2 or 3 complete English sentences that say what the user means.',
    ),
  vocab: z
    .array(
      z.object({
        phrase: z
          .string()
          .describe(
            'A word or phrase copied exactly from one of the suggestions.',
          ),
        meaning: z
          .string()
          .describe(
            'Short Vietnamese explanation of its meaning and when to use it.',
          ),
      }),
    )
    .describe(
      'Uncommon words, phrasal verbs, idioms or slang worth learning. May be empty.',
    ),
})
export type SuggestResult = z.infer<typeof suggestResultSchema>
export type VocabNote = SuggestResult['vocab'][number]

// For the client's useObject, which only uses it for typing
export const assistResultSchema = z.union([
  fixResultSchema,
  suggestResultSchema,
])
export type AssistResult = z.infer<typeof assistResultSchema>
