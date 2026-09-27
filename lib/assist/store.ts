import 'server-only'
import { createHash } from 'node:crypto'

import type { z } from 'zod'

import type { EditType, Mode, Tone } from '@/generated/prisma/enums'
import type {
  AssistResult,
  Mode as RequestMode,
  Tone as RequestTone,
} from '@/lib/assist/schema'
import { db } from '@/lib/db'

// Whitespace doesn't change the answer, case does (Fix corrects capitalization)
export function normalizeInput(input: string) {
  return input.trim().replace(/\s+/g, ' ')
}

// Everything that shapes the output goes into the key, so editing a prompt,
// schema or model route naturally stops reusing old answers
export function cacheKey(parts: {
  mode: string
  tone: RequestTone
  input: string
  model: string
  instructions: string
  schema: unknown
}) {
  return createHash('sha256')
    .update(JSON.stringify({ ...parts, input: normalizeInput(parts.input) }))
    .digest('hex')
}

// Latest stored session for this key: its id, which a regenerate overwrites, and its
// output unless it no longer fits the schema. A DB failure is a miss, never an error:
// the assist itself matters more than the cache.
export async function findLatestSession<T>(
  userId: string,
  key: string,
  schema: z.ZodType<T>,
): Promise<{ id: string; output: T | null } | null> {
  try {
    const hit = await db.session.findFirst({
      where: { userId, cacheKey: key },
      orderBy: { createdAt: 'desc' },
      select: { id: true, output: true },
    })
    if (!hit) return null
    const parsed = schema.safeParse(hit.output)
    return { id: hit.id, output: parsed.success ? parsed.data : null }
  } catch (error) {
    console.error('assist cache lookup failed', error)
    return null
  }
}

// Edits are only stored for Fix, whose output is the only one that has them
export async function saveSession(session: {
  id: string
  userId: string
  mode: RequestMode
  tone: RequestTone
  input: string
  output: AssistResult
  model: string
  latencyMs: number
  cacheKey: string
}) {
  const { id, userId, output } = session
  const edits = ('edits' in output ? output.edits : []).map((e) => ({
    userId,
    original: e.original,
    replacement: e.replacement,
    type: e.type.toUpperCase() as EditType,
    explanation: e.explanation,
  }))
  const data = {
    ...session,
    mode: session.mode.toUpperCase() as Mode,
    tone: session.tone.toUpperCase() as Tone,
  }

  await db.$transaction(async (tx) => {
    await tx.session.upsert({
      where: { id },
      create: { ...data, id, edits: { create: edits } },
      update: {
        ...data,
        createdAt: new Date(),
        edits: { deleteMany: {}, create: edits },
      },
    })
    await tx.session.deleteMany({
      where: { userId, cacheKey: session.cacheKey, id: { not: id } },
    })
  })
}
