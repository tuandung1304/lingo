// @vitest-environment node
import type * as Ai from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FixResult, SuggestResult } from '@/lib/assist/schema'

const { findFirst, upsert, deleteMany, streamText, afterCallbacks } =
  vi.hoisted(() => ({
    findFirst: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    streamText: vi.fn(),
    afterCallbacks: [] as (() => unknown)[],
  }))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: async () => ({ id: 'user-1', email: 'me@example.com' }),
}))
vi.mock('@/lib/db', () => {
  const session = { findFirst, upsert, deleteMany }
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

const SUGGEST_RESULT: SuggestResult = {
  suggestions: ['The server was lagging like crazy yesterday.'],
  vocab: [{ phrase: 'like crazy', meaning: 'Rất nhiều, dữ dội.' }],
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
  upsert.mockReset().mockResolvedValue({})
  deleteMany.mockReset().mockResolvedValue({})
  afterCallbacks.length = 0
  streamText.mockReset().mockReturnValue({
    output: Promise.resolve(FIX_RESULT),
    toTextStreamResponse: (init?: ResponseInit) =>
      new Response(JSON.stringify(FIX_RESULT), init),
  })
})

describe('POST /api/assist', () => {
  it('returns a cached output without calling the model', async () => {
    findFirst.mockResolvedValue({ id: 'old', output: FIX_RESULT })

    const res = await post({
      mode: 'fix',
      input: 'I goes to school every day.',
      tone: 'casual',
    })

    expect(res.headers.get('x-assist-cache')).toBe('hit')
    expect(await res.json()).toEqual(FIX_RESULT)
    expect(streamText).not.toHaveBeenCalled()
  })

  it('returns the cached session id with a cache hit', async () => {
    findFirst.mockResolvedValue({ id: 'old', output: FIX_RESULT })

    const res = await post({ mode: 'fix', input: 'hello', tone: 'casual' })

    expect(res.headers.get('x-assist-session')).toBe('old')
  })

  it('skips the cache and overwrites the latest session when fresh is set', async () => {
    findFirst.mockResolvedValue({ id: 'old', output: FIX_RESULT })

    const res = await post({
      mode: 'fix',
      input: 'hello',
      tone: 'casual',
      fresh: true,
    })
    await runAfter()

    expect(streamText).toHaveBeenCalledOnce()
    expect(res.headers.get('x-assist-session')).toBe('old')
    const { where, update } = upsert.mock.calls[0][0]
    expect(where).toEqual({ id: 'old' })
    expect(update).toMatchObject({
      output: FIX_RESULT,
      edits: {
        deleteMany: {},
        create: [expect.objectContaining({ type: 'WORD_CHOICE' })],
      },
    })
  })

  it('saves a new request under the id it sent to the client', async () => {
    const res = await post({
      mode: 'fix',
      input: 'I goes to school every day.',
      tone: 'casual',
    })
    await runAfter()

    const id = res.headers.get('x-assist-session')
    expect(id).toBeTruthy()
    const { where, create } = upsert.mock.calls[0][0]
    expect(where).toEqual({ id })
    expect(create).toMatchObject({
      id,
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

  it('removes other sessions with the same key when saving', async () => {
    const res = await post({ mode: 'fix', input: 'hello', tone: 'casual' })
    await runAfter()

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        cacheKey: findFirst.mock.calls[0][0].where.cacheKey,
        id: { not: res.headers.get('x-assist-session') },
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

    expect(upsert).not.toHaveBeenCalled()
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
    findFirst.mockResolvedValue({
      id: 'old',
      output: { corrected: 'old shape' },
    })

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

  describe('suggest mode', () => {
    beforeEach(() => {
      streamText.mockReturnValue({
        output: Promise.resolve(SUGGEST_RESULT),
        toTextStreamResponse: (init?: ResponseInit) =>
          new Response(JSON.stringify(SUGGEST_RESULT), init),
      })
    })

    it('asks the model with the suggest prompt', async () => {
      await post({
        mode: 'suggest',
        input: 'server lag hôm qua',
        tone: 'casual',
      })

      const { instructions, prompt } = streamText.mock.calls[0][0]
      expect(instructions).toContain('infer the intended meaning')
      expect(prompt).toBe('server lag hôm qua')
    })

    it('saves the session as SUGGEST without edits', async () => {
      await post({ mode: 'suggest', input: 'server lag', tone: 'casual' })
      await runAfter()

      expect(upsert.mock.calls[0][0].create).toMatchObject({
        mode: 'SUGGEST',
        output: SUGGEST_RESULT,
        edits: { create: [] },
      })
    })

    it('returns a cached suggest output', async () => {
      findFirst.mockResolvedValue({ id: 'old', output: SUGGEST_RESULT })

      const res = await post({ mode: 'suggest', input: 'lag', tone: 'casual' })

      expect(await res.json()).toEqual(SUGGEST_RESULT)
      expect(streamText).not.toHaveBeenCalled()
    })

    it('uses a different key than fix for the same input', async () => {
      await post({ mode: 'fix', input: 'server lag', tone: 'casual' })
      await post({ mode: 'suggest', input: 'server lag', tone: 'casual' })

      const [a, b] = findFirst.mock.calls.map((c) => c[0].where.cacheKey)
      expect(a).not.toBe(b)
    })
  })
})
