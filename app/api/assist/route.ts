import { randomUUID } from 'node:crypto'

import { Output, streamText } from 'ai'
import { after } from 'next/server'
import { z } from 'zod'

import { modelFor, streamingObjectOptions } from '@/lib/ai/models'
import { MODE_CONFIG } from '@/lib/ai/modes'
import { assistRequestSchema, type Mode } from '@/lib/assist/schema'
import { cacheKey, findLatestSession, saveSession } from '@/lib/assist/store'
import { getCurrentUser } from '@/lib/auth'

export const maxDuration = 30

const SCHEMA_JSON = Object.fromEntries(
  Object.entries(MODE_CONFIG).map(([mode, c]) => [
    mode,
    z.toJSONSchema(c.schema),
  ]),
) as Record<Mode, unknown>

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

  const config = MODE_CONFIG[mode]
  const { id: modelId, model } = modelFor(config.task)
  const instructions = config.instructions(tone)
  const key = cacheKey({
    mode,
    tone,
    input,
    model: modelId,
    instructions,
    schema: SCHEMA_JSON[mode],
  })

  // useObject parses the body as accumulating JSON, so a whole object works like a stream
  const latest = await findLatestSession(user.id, key, config.schema)
  if (!fresh && latest?.output) {
    return new Response(JSON.stringify(latest.output), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-assist-cache': 'hit',
        'x-assist-session': latest.id,
      },
    })
  }
  // A regenerate replaces the latest answer, so it keeps that session's id
  const sessionId = latest?.id ?? randomUUID()

  const start = Date.now()
  const result = streamText({
    model,
    output: Output.object({ schema: config.schema }),
    instructions,
    prompt: input,
    temperature: config.temperature,
    maxOutputTokens: 800,
    providerOptions: streamingObjectOptions,
    abortSignal: request.signal,
  })

  // Chained now so a rejection is always handled; after() keeps the function alive for it.
  // A stopped or failed stream has no complete output and is not saved.
  const saved = Promise.resolve(result.output)
    .then((output) =>
      saveSession({
        id: sessionId,
        userId: user.id,
        mode,
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

  return result.toTextStreamResponse({
    headers: { 'x-assist-session': sessionId },
  })
}
