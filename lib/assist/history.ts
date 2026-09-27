import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import { type FixResult, fixResultSchema, type Tone } from '@/lib/assist/schema'
import { db } from '@/lib/db'

export const HISTORY_PAGE_SIZE = 30

export type HistoryItem = {
  id: string
  input: string
  tone: Tone
  output: FixResult
  createdAt: Date
}

const ITEM_SELECT = {
  id: true,
  input: true,
  tone: true,
  output: true,
  createdAt: true,
} satisfies Prisma.SessionSelect

type ItemRow = Prisma.SessionGetPayload<{ select: typeof ITEM_SELECT }>

// Rows from an older schema are skipped rather than breaking the page
function toItem(row: ItemRow): HistoryItem | null {
  const output = fixResultSchema.safeParse(row.output)
  if (!output.success) return null
  return {
    id: row.id,
    input: row.input,
    tone: row.tone.toLowerCase() as Tone,
    output: output.data,
    createdAt: row.createdAt,
  }
}

// One of the user's sessions, or null if it is missing, someone else's or unreadable
export async function getHistoryItem(
  userId: string,
  id: string,
): Promise<HistoryItem | null> {
  const row = await db.session.findFirst({
    where: { id, userId, mode: 'FIX' },
    select: ITEM_SELECT,
  })
  return row ? toItem(row) : null
}

// Newest first. `q` matches the input (any case) or the corrected sentence.
export async function listHistory(
  userId: string,
  { q, cursor }: { q?: string; cursor?: string } = {},
): Promise<{ items: HistoryItem[]; nextCursor: string | null }> {
  const query = q?.trim()
  const where: Prisma.SessionWhereInput = {
    userId,
    mode: 'FIX',
    ...(query && {
      OR: [
        { input: { contains: query, mode: 'insensitive' } },
        { output: { path: ['corrected'], string_contains: query } },
      ],
    }),
  }

  // One extra row tells whether there is another page
  const rows = await db.session.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: HISTORY_PAGE_SIZE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: ITEM_SELECT,
  })

  const page = rows.slice(0, HISTORY_PAGE_SIZE)
  const items = page.flatMap((row) => toItem(row) ?? [])

  return {
    items,
    nextCursor: rows.length > HISTORY_PAGE_SIZE ? page.at(-1)!.id : null,
  }
}
