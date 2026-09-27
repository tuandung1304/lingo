import 'server-only'
import type { Prisma } from '@/generated/prisma/client'
import type { Mode as DbMode } from '@/generated/prisma/enums'
import {
  type FixResult,
  fixResultSchema,
  type Mode,
  type SuggestResult,
  suggestResultSchema,
  type Tone,
} from '@/lib/assist/schema'
import { db } from '@/lib/db'

export const HISTORY_PAGE_SIZE = 30

export type HistoryItem = {
  id: string
  input: string
  tone: Tone
  createdAt: Date
} & (
  | { mode: 'fix'; output: FixResult }
  | { mode: 'suggest'; output: SuggestResult }
)

const ITEM_SELECT = {
  id: true,
  mode: true,
  input: true,
  tone: true,
  output: true,
  createdAt: true,
} satisfies Prisma.SessionSelect

type ItemRow = Prisma.SessionGetPayload<{ select: typeof ITEM_SELECT }>

// Rows from an older schema are skipped rather than breaking the page
function toItem(row: ItemRow): HistoryItem | null {
  const base = {
    id: row.id,
    input: row.input,
    tone: row.tone.toLowerCase() as Tone,
    createdAt: row.createdAt,
  }
  if (row.mode === 'FIX') {
    const output = fixResultSchema.safeParse(row.output)
    return output.success ? { ...base, mode: 'fix', output: output.data } : null
  }
  const output = suggestResultSchema.safeParse(row.output)
  return output.success
    ? { ...base, mode: 'suggest', output: output.data }
    : null
}

// One of the user's sessions, or null if it is missing, someone else's or unreadable
export async function getHistoryItem(
  userId: string,
  id: string,
): Promise<HistoryItem | null> {
  const row = await db.session.findFirst({
    where: { id, userId },
    select: ITEM_SELECT,
  })
  return row ? toItem(row) : null
}

// Suggest returns at most 3 sentences; JSON paths can't search a whole array
const SUGGESTION_PATHS = ['0', '1', '2'].map((i) => ['suggestions', i])

// Newest first. `q` matches the input (any case), the corrected sentence or a suggestion.
export async function listHistory(
  userId: string,
  { q, cursor, mode }: { q?: string; cursor?: string; mode?: Mode } = {},
): Promise<{ items: HistoryItem[]; nextCursor: string | null }> {
  const query = q?.trim()
  const where: Prisma.SessionWhereInput = {
    userId,
    ...(mode && { mode: mode.toUpperCase() as DbMode }),
    ...(query && {
      OR: [
        { input: { contains: query, mode: 'insensitive' } },
        { output: { path: ['corrected'], string_contains: query } },
        ...SUGGESTION_PATHS.map((path) => ({
          output: { path, string_contains: query },
        })),
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
