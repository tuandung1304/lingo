import { Output, streamText } from 'ai'

import { modelFor, streamingObjectOptions } from '@/lib/ai/models'
import { fixSystemPrompt } from '@/lib/ai/modes/fix'
import { assistRequestSchema, fixResultSchema } from '@/lib/assist/schema'
import { getCurrentUser } from '@/lib/auth'

export const maxDuration = 30

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = assistRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { input, tone } = parsed.data

  const { model } = modelFor('fix')
  const result = streamText({
    model,
    output: Output.object({ schema: fixResultSchema }),
    instructions: fixSystemPrompt(tone),
    prompt: input,
    temperature: 0.3,
    maxOutputTokens: 800,
    providerOptions: streamingObjectOptions,
    abortSignal: request.signal,
  })

  return result.toTextStreamResponse()
}
