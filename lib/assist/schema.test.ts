// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  assistRequestSchema,
  fixResultSchema,
  suggestResultSchema,
} from './schema'

describe('assistRequestSchema', () => {
  it('accepts a valid fix request', () => {
    const result = assistRequestSchema.safeParse({
      mode: 'fix',
      input: 'I go to school yesterday',
      tone: 'casual',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid suggest request', () => {
    const result = assistRequestSchema.safeParse({
      mode: 'suggest',
      input: 'lag, server, yesterday',
      tone: 'casual',
    })
    expect(result.success).toBe(true)
  })

  it('trims the input', () => {
    const result = assistRequestSchema.safeParse({
      mode: 'fix',
      input: '  hello  ',
      tone: 'neutral',
    })
    expect(result.success).toBe(true)
    expect(result.data?.input).toBe('hello')
  })

  it('rejects an empty input', () => {
    const result = assistRequestSchema.safeParse({
      mode: 'fix',
      input: '   ',
      tone: 'casual',
    })
    expect(result.success).toBe(false)
  })

  it('rejects input longer than 1000 characters', () => {
    const result = assistRequestSchema.safeParse({
      mode: 'fix',
      input: 'a'.repeat(1001),
      tone: 'casual',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown tone', () => {
    const result = assistRequestSchema.safeParse({
      mode: 'fix',
      input: 'hi',
      tone: 'sarcastic',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown mode', () => {
    const result = assistRequestSchema.safeParse({
      mode: 'keywords',
      input: 'hi',
      tone: 'casual',
    })
    expect(result.success).toBe(false)
  })
})

describe('fixResultSchema', () => {
  it('accepts a well-formed model response', () => {
    const result = fixResultSchema.safeParse({
      corrected: 'I went to school yesterday.',
      alternatives: ['I was at school yesterday.'],
      edits: [
        {
          original: 'go',
          replacement: 'went',
          type: 'grammar',
          explanation: 'Past tense is needed for "yesterday".',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an edit with an invalid type', () => {
    const result = fixResultSchema.safeParse({
      corrected: 'ok',
      alternatives: [],
      edits: [
        {
          original: 'a',
          replacement: 'b',
          type: 'style',
          explanation: 'x',
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('requires corrected, alternatives and edits to be present', () => {
    const result = fixResultSchema.safeParse({ corrected: 'ok' })
    expect(result.success).toBe(false)
  })
})

describe('suggestResultSchema', () => {
  it('accepts suggestions with vocab notes', () => {
    const result = suggestResultSchema.safeParse({
      suggestions: ['The server was lagging yesterday.'],
      vocab: [{ phrase: 'lagging', meaning: 'Bị giật, trễ.' }],
    })
    expect(result.success).toBe(true)
  })

  it('requires both suggestions and vocab', () => {
    const result = suggestResultSchema.safeParse({ suggestions: ['hi'] })
    expect(result.success).toBe(false)
  })
})
