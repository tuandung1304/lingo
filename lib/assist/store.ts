import 'server-only'
import { createHash } from 'node:crypto'

import type { z } from 'zod'

import type { EditType, Mode, Tone } from '@/generated/prisma/enums'
import type { FixResult, Tone as RequestTone } from '@/lib/assist/schema'
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

// Latest stored output for this key, or null. A DB failure is a miss, never an error:
// the assist itself matters more than the cache.
export async function findCachedOutput<T>(
  userId: string,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const hit = await db.session.findFirst({
      where: { userId, cacheKey: key },
      orderBy: { createdAt: 'desc' },
      select: { output: true },
    })
    if (!hit) return null
    const parsed = schema.safeParse(hit.output)
    return parsed.success ? parsed.data : null
  } catch (error) {
    console.error('assist cache lookup failed', error)
    return null
  }
}

export async function saveFixSession(session: {
  userId: string
  tone: RequestTone
  input: string
  output: FixResult
  model: string
  latencyMs: number
  cacheKey: string
}) {
  const { userId, output } = session
  const edits = output.edits.map((e) => ({
    userId,
    original: e.original,
    replacement: e.replacement,
    type: e.type.toUpperCase() as EditType,
    explanation: e.explanation,
  }))
  const data = {
    ...session,
    mode: 'FIX' as Mode,
    tone: session.tone.toUpperCase() as Tone,
  }

  await db.$transaction(async (tx) => {
    const existing = await tx.session.findMany({
      where: { userId, cacheKey: session.cacheKey },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    const [latest, ...duplicates] = existing

    if (!latest) {
      await tx.session.create({ data: { ...data, edits: { create: edits } } })
      return
    }

    await tx.session.update({
      where: { id: latest.id },
      data: {
        ...data,
        createdAt: new Date(),
        edits: { deleteMany: {}, create: edits },
      },
    })
    if (duplicates.length > 0) {
      await tx.session.deleteMany({
        where: { id: { in: duplicates.map((d) => d.id) } },
      })
    }
  })
}
