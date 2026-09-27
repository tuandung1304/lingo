// @vitest-environment node
import type * as Ai from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixResult } from '@/lib/assist/schema'

const {
  findFirst,
  findMany,
  create,
  update,
  deleteMany,
  streamText,
  afterCallbacks,
} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  streamText: vi.fn(),
  afterCallbacks: [] as (() => unknown)[],
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({ id: 'user-1', email: 'me@example.com' }),
}))
vi.mock('@/lib/db', () => {
  const session = { findFirst, findMany, create, update, deleteMany }
  return {
    db: {
      session,
      $transaction: (fn: (tx: unknown) => unknown) => fn({ session }),
    },
  }
})
vi.mock('next/server', () => ({
  after: (cb: () => unknown) => afterCallbacks.push(cb),
}))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof Ai>()),
  streamText,
}))

import { POST } from './route'

const FIX_RESULT: FixResult = {
  corrected: 'I go to school every day.',
  alternatives: [],
  edits: [
    {
      original: 'goes',
      replacement: 'go',
      type: 'word_choice',
      explanation: 'Chủ ngữ "I" dùng "go".',
    },
  ],
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/assist', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

async function runAfter() {
  await Promise.all(afterCallbacks.map((cb) => cb()))
}

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null)
  findMany.mockReset().mockResolvedValue([])
  create.mockReset().mockResolvedValue({})
  update.mockReset().mockResolvedValue({})
  deleteMany.mockReset().mockResolvedValue({})
  afterCallbacks.length = 0
  streamText.mockReset().mockReturnValue({
    output: Promise.resolve(FIX_RESULT),
    toTextStreamResponse: () => new Response(JSON.stringify(FIX_RESULT)),
  })
})

describe('POST /api/assist', () => {
  it('returns a cached output without calling the model', async () => {
    findFirst.mockResolvedValue({ output: FIX_RESULT })

    const res = await post({
      mode: 'fix',
      input: 'I goes to school every day.',
      tone: 'casual',
    })

    expect(res.headers.get('x-assist-cache')).toBe('hit')
    expect(await res.json()).toEqual(FIX_RESULT)
    expect(streamText).not.toHaveBeenCalled()
  })

  it('skips the cache and saves a new answer when fresh is set', async () => {
    findFirst.mockResolvedValue({ output: FIX_RESULT })

    await post({ mode: 'fix', input: 'hello', tone: 'casual', fresh: true })
    await runAfter()

    expect(findFirst).not.toHaveBeenCalled()
    expect(streamText).toHaveBeenCalledOnce()
    expect(create).toHaveBeenCalledOnce()
  })

  it('overwrites the existing session and its edits on regenerate', async () => {
    findMany.mockResolvedValue([{ id: 'old' }])

    await post({ mode: 'fix', input: 'hello', tone: 'casual', fresh: true })
    await runAfter()

    expect(create).not.toHaveBeenCalled()
    const { where, data } = update.mock.calls[0][0]
    expect(where).toEqual({ id: 'old' })
    expect(data).toMatchObject({
      output: FIX_RESULT,
      edits: {
        deleteMany: {},
        create: [expect.objectContaining({ type: 'WORD_CHOICE' })],
      },
    })
    expect(deleteMany).not.toHaveBeenCalled()
  })

  it('removes older duplicates of the same request when saving', async () => {
    findMany.mockResolvedValue([
      { id: 'newest' },
      { id: 'dup1' },
      { id: 'dup2' },
    ])

    await post({ mode: 'fix', input: 'hello', tone: 'casual', fresh: true })
    await runAfter()

    expect(update.mock.calls[0][0].where).toEqual({ id: 'newest' })
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['dup1', 'dup2'] } },
    })
  })

  it('saves the session and its edits once the stream finishes', async () => {
    await post({
      mode: 'fix',
      input: 'I goes to school every day.',
      tone: 'casual',
    })
    await runAfter()

    const { data } = create.mock.calls[0][0]
    expect(data).toMatchObject({
      userId: 'user-1',
      mode: 'FIX',
      tone: 'CASUAL',
      input: 'I goes to school every day.',
      output: FIX_RESULT,
      cacheKey: findFirst.mock.calls[0][0].where.cacheKey,
      edits: {
        create: [
          {
            userId: 'user-1',
            original: 'goes',
            replacement: 'go',
            type: 'WORD_CHOICE',
            explanation: 'Chủ ngữ "I" dùng "go".',
          },
        ],
      },
    })
  })

  it('does not save when the stream ends without a complete output', async () => {
    streamText.mockReturnValue({
      output: Promise.reject(new Error('No output generated')),
      toTextStreamResponse: () => new Response(''),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await post({ mode: 'fix', input: 'hello', tone: 'casual' })
    await runAfter()

    expect(create).not.toHaveBeenCalled()
  })

  it('looks up the same key regardless of extra whitespace', async () => {
    await post({ mode: 'fix', input: 'i  goes\nhome', tone: 'casual' })
    await post({ mode: 'fix', input: 'i goes home', tone: 'casual' })

    const [a, b] = findFirst.mock.calls.map((c) => c[0].where.cacheKey)
    expect(a).toBe(b)
  })

  it('uses a different key per tone and per casing', async () => {
    await post({ mode: 'fix', input: 'i goes home', tone: 'casual' })
    await post({ mode: 'fix', input: 'i goes home', tone: 'polite' })
    await post({ mode: 'fix', input: 'I goes home', tone: 'casual' })

    const keys = findFirst.mock.calls.map((c) => c[0].where.cacheKey)
    expect(new Set(keys).size).toBe(3)
  })

  it('treats a stored output that no longer fits the schema as a miss', async () => {
    findFirst.mockResolvedValue({ output: { corrected: 'old shape' } })

    await post({ mode: 'fix', input: 'hello', tone: 'casual' })

    expect(streamText).toHaveBeenCalledOnce()
  })

  it('still answers when the cache lookup fails', async () => {
    findFirst.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await post({ mode: 'fix', input: 'hello', tone: 'casual' })

    expect(res.ok).toBe(true)
    expect(streamText).toHaveBeenCalledOnce()
  })
})
