// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildSegments } from './highlight'
import type { FixEdit } from './schema'

function edit(overrides: Partial<FixEdit>): FixEdit {
  return {
    original: '',
    replacement: '',
    type: 'grammar',
    explanation: 'because grammar',
    ...overrides,
  }
}

describe('buildSegments', () => {
  it('returns a single "same" segment when nothing changed', () => {
    const segments = buildSegments('I like pizza', 'I like pizza', [])
    expect(segments).toEqual([{ kind: 'same', text: 'I like pizza' }])
  })

  it('marks a single-word replacement as a change segment', () => {
    const segments = buildSegments('I goes home', 'I go home', [])

    const change = segments.find((s) => s.kind === 'change')
    expect(change).toMatchObject({
      removed: expect.stringContaining('goes'),
      added: expect.stringContaining('go'),
      edit: undefined,
    })
    // "same" text before and after the change, ignoring how whitespace is
    // distributed between the "same"/"change" segments by the diff library
    expect(
      segments.map((s) => (s.kind === 'same' ? s.text : s.added)).join(''),
    ).toContain('home')
  })

  it('handles a pure insertion (nothing removed)', () => {
    const segments = buildSegments('I go home', 'I go back home', [])
    const change = segments.find((s) => s.kind === 'change')
    expect(change).toMatchObject({
      removed: '',
      added: expect.stringContaining('back'),
    })
  })

  it('handles a pure deletion (nothing added)', () => {
    const segments = buildSegments('I go back home', 'I go home', [])
    const change = segments.find((s) => s.kind === 'change')
    expect(change).toMatchObject({
      removed: expect.stringContaining('back'),
      added: '',
    })
  })

  it('attaches the edit that exactly matches removed/added text', () => {
    const edits = [
      edit({
        original: 'goes',
        replacement: 'go',
        explanation: 'subject-verb agreement',
      }),
    ]
    const segments = buildSegments('I goes home', 'I go home', edits)
    const change = segments.find((s) => s.kind === 'change')
    expect(change?.edit).toBe(edits[0])
  })

  it('falls back to a partial (overlapping) match when exact text differs slightly', () => {
    // diff granularity can produce "goes " / "go " (with trailing space) while
    // the model reports the edit without it; matching must tolerate that.
    const edits = [edit({ original: 'goes', replacement: 'go' })]
    const segments = buildSegments('She goes home', 'She go home', edits)
    const change = segments.find((s) => s.kind === 'change')
    expect(change?.edit).toBe(edits[0])
  })

  it('leaves a change unmatched when no edit overlaps it', () => {
    const edits = [edit({ original: 'unrelated', replacement: 'other' })]
    const segments = buildSegments('I goes home', 'I go home', edits)
    const change = segments.find((s) => s.kind === 'change')
    expect(change?.edit).toBeUndefined()
  })

  it('handles multiple separate changes in one sentence', () => {
    const edits = [
      edit({ original: 'goes', replacement: 'go' }),
      edit({ original: 'yesterday', replacement: 'today' }),
    ]
    const segments = buildSegments(
      'I goes home yesterday',
      'I go home today',
      edits,
    )
    const changes = segments.filter((s) => s.kind === 'change')
    expect(changes).toHaveLength(2)
    expect(changes[0].edit).toBe(edits[0])
    expect(changes[1].edit).toBe(edits[1])
  })
})
