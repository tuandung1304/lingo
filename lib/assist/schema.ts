import { z } from 'zod'

// Shared by the /api/assist route and the client (useObject)

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
  mode: z.literal('fix'),
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
