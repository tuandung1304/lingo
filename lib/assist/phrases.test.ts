// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { markPhrases } from './phrases'

const note = (phrase: string) => ({ phrase, meaning: `nghĩa của ${phrase}` })

describe('markPhrases', () => {
  it('returns the whole text when there is no vocab', () => {
    expect(markPhrases('The server is lagging.', [])).toEqual([
      { text: 'The server is lagging.' },
    ])
  })

  it('marks a phrase ignoring case', () => {
    const v = note('hop on')

    expect(markPhrases('Wanna Hop On later?', [v])).toEqual([
      { text: 'Wanna ' },
      { text: 'Hop On', note: v },
      { text: ' later?' },
    ])
  })

  it('only matches whole words', () => {
    expect(markPhrases('It keeps lagging.', [note('lag')])).toEqual([
      { text: 'It keeps lagging.' },
    ])
  })

  it('prefers the longer phrase when two overlap', () => {
    const long = note('call it a night')
    const short = note('call it')

    const parts = markPhrases("Let's call it a night, call it done.", [
      short,
      long,
    ])

    expect(parts.filter((p) => p.note)).toEqual([
      { text: 'call it a night', note: long },
      { text: 'call it', note: short },
    ])
  })

  it('marks each phrase once and ignores phrases not in the text', () => {
    const parts = markPhrases('gg, gg everyone', [
      note('gg'),
      note('rage quit'),
    ])

    expect(parts.filter((p) => p.note).map((p) => p.text)).toEqual(['gg'])
  })

  it('treats regex characters in a phrase literally', () => {
    const v = note('A.F.K.')

    expect(markPhrases('Going A.F.K. now', [v])[1]).toEqual({
      text: 'A.F.K.',
      note: v,
    })
  })
})
