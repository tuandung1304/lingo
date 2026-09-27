// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixResult, SuggestResult } from '@/lib/assist/schema'

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: { session: { findMany, findFirst } } }))

import { getHistoryItem, HISTORY_PAGE_SIZE, listHistory } from './history'

const OUTPUT: FixResult = {
  corrected: 'Hi there.',
  alternatives: [],
  edits: [],
}

const SUGGEST: SuggestResult = {
  suggestions: ['Server was lagging.'],
  vocab: [],
}

function row(id: string, output: unknown = OUTPUT, mode = 'FIX') {
  return {
    id,
    mode,
    input: 'hi there',
    tone: 'CASUAL',
    output,
    createdAt: new Date('2026-09-27T10:00:00Z'),
  }
}

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([])
  findFirst.mockReset().mockResolvedValue(null)
})

describe('getHistoryItem', () => {
  it('only finds the session among the given user’s sessions', async () => {
    await getHistoryItem('user-1', 's1')

    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      id: 's1',
      userId: 'user-1',
    })
  })

  it('returns the parsed session', async () => {
    findFirst.mockResolvedValue(row('s1'))

    expect(await getHistoryItem('user-1', 's1')).toMatchObject({
      id: 's1',
      tone: 'casual',
      output: OUTPUT,
    })
  })

  it('returns a suggest session with its mode', async () => {
    findFirst.mockResolvedValue(row('s2', SUGGEST, 'SUGGEST'))

    expect(await getHistoryItem('user-1', 's2')).toMatchObject({
      mode: 'suggest',
      output: SUGGEST,
    })
  })

  it('returns null when the session is missing or unreadable', async () => {
    expect(await getHistoryItem('user-1', 'nope')).toBeNull()

    findFirst.mockResolvedValue(row('old', { corrected: 1 }))
    expect(await getHistoryItem('user-1', 'old')).toBeNull()
  })
})

describe('listHistory', () => {
  it('only reads the given user’s sessions', async () => {
    await listHistory('user-1')

    expect(findMany.mock.calls[0][0].where).toMatchObject({ userId: 'user-1' })
  })

  it('returns items with lowercase tone and parsed output', async () => {
    findMany.mockResolvedValue([row('a')])

    const { items, nextCursor } = await listHistory('user-1')

    expect(items).toEqual([
      expect.objectContaining({ id: 'a', tone: 'casual', output: OUTPUT }),
    ])
    expect(nextCursor).toBeNull()
  })

  it('returns the last item’s id as the cursor when there is another page', async () => {
    const rows = Array.from({ length: HISTORY_PAGE_SIZE + 1 }, (_, i) =>
      row(`s${i}`),
    )
    findMany.mockResolvedValue(rows)

    const { items, nextCursor } = await listHistory('user-1')

    expect(items).toHaveLength(HISTORY_PAGE_SIZE)
    expect(nextCursor).toBe(`s${HISTORY_PAGE_SIZE - 1}`)
  })

  it('starts after the cursor row', async () => {
    await listHistory('user-1', { cursor: 's29' })

    expect(findMany.mock.calls[0][0]).toMatchObject({
      cursor: { id: 's29' },
      skip: 1,
    })
  })

  it('searches the input, the corrected sentence and the suggestions', async () => {
    await listHistory('user-1', { q: '  school ' })

    expect(findMany.mock.calls[0][0].where.OR).toEqual([
      { input: { contains: 'school', mode: 'insensitive' } },
      { output: { path: ['corrected'], string_contains: 'school' } },
      { output: { path: ['suggestions', '0'], string_contains: 'school' } },
      { output: { path: ['suggestions', '1'], string_contains: 'school' } },
      { output: { path: ['suggestions', '2'], string_contains: 'school' } },
    ])
  })

  it('lists every mode unless one is given', async () => {
    await listHistory('user-1')
    await listHistory('user-1', { mode: 'suggest' })

    expect(findMany.mock.calls[0][0].where.mode).toBeUndefined()
    expect(findMany.mock.calls[1][0].where.mode).toBe('SUGGEST')
  })

  it('parses each row by its own mode', async () => {
    findMany.mockResolvedValue([
      row('a'),
      row('b', SUGGEST, 'SUGGEST'),
      row('c', OUTPUT, 'SUGGEST'),
    ])

    const { items } = await listHistory('user-1')

    expect(items.map((i) => [i.id, i.mode])).toEqual([
      ['a', 'fix'],
      ['b', 'suggest'],
    ])
  })

  it('ignores a blank search', async () => {
    await listHistory('user-1', { q: '   ' })

    expect(findMany.mock.calls[0][0].where.OR).toBeUndefined()
  })

  it('skips rows whose output no longer fits the schema', async () => {
    findMany.mockResolvedValue([row('old', { corrected: 1 }), row('ok')])

    const { items } = await listHistory('user-1')

    expect(items.map((i) => i.id)).toEqual(['ok'])
  })
})
