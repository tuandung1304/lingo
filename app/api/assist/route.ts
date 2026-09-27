import { Output, streamText } from 'ai'
import { after } from 'next/server'
import { z } from 'zod'

import { modelFor, streamingObjectOptions } from '@/lib/ai/models'
import { fixSystemPrompt } from '@/lib/ai/modes/fix'
import { assistRequestSchema, fixResultSchema } from '@/lib/assist/schema'
import { cacheKey, findCachedOutput, saveFixSession } from '@/lib/assist/store'
import { getCurrentUser } from '@/lib/auth'

export const maxDuration = 30

const fixSchemaJson = z.toJSONSchema(fixResultSchema)

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = assistRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { mode, input, tone, fresh } = parsed.data

  const { id: modelId, model } = modelFor('fix')
  const instructions = fixSystemPrompt(tone)
  const key = cacheKey({
    mode,
    tone,
    input,
    model: modelId,
    instructions,
    schema: fixSchemaJson,
  })

  // useObject parses the body as accumulating JSON, so a whole object works like a stream
  const cached = fresh
    ? null
    : await findCachedOutput(user.id, key, fixResultSchema)
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-assist-cache': 'hit',
      },
    })
  }

  const start = Date.now()
  const result = streamText({
    model,
    output: Output.object({ schema: fixResultSchema }),
    instructions,
    prompt: input,
    temperature: 0.3,
    maxOutputTokens: 800,
    providerOptions: streamingObjectOptions,
    abortSignal: request.signal,
  })

  // Chained now so a rejection is always handled; after() keeps the function alive for it.
  // A stopped or failed stream has no complete output and is not saved.
  const saved = Promise.resolve(result.output)
    .then((output) =>
      saveFixSession({
        userId: user.id,
        tone,
        input,
        output,
        model: modelId,
        latencyMs: Date.now() - start,
        cacheKey: key,
      }),
    )
    .catch((error) => {
      if (!request.signal.aborted) console.error('assist save failed', error)
    })
  after(() => saved)

  return result.toTextStreamResponse()
}
