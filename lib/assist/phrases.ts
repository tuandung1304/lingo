import type { VocabNote } from '@/lib/assist/schema'

export interface PhrasePart {
  text: string
  note?: VocabNote
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Splits a suggestion so each vocab phrase in it can be underlined. Matching ignores
// case and needs whole words; each phrase is marked at its first free spot, longer
// phrases first so "hop on" wins over "hop".
export function markPhrases(text: string, vocab: VocabNote[]): PhrasePart[] {
  const ranges: { start: number; end: number; note: VocabNote }[] = []
  const byLength = vocab
    .filter((v) => v.phrase.trim())
    .toSorted((a, b) => b.phrase.trim().length - a.phrase.trim().length)

  for (const note of byLength) {
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${escape(note.phrase.trim())}(?![\\p{L}\\p{N}])`,
      'giu',
    )
    for (const m of text.matchAll(re)) {
      const start = m.index
      const end = start + m[0].length
      if (ranges.some((r) => start < r.end && r.start < end)) continue
      ranges.push({ start, end, note })
      break
    }
  }

  ranges.sort((a, b) => a.start - b.start)
  const parts: PhrasePart[] = []
  let at = 0
  for (const r of ranges) {
    if (r.start > at) parts.push({ text: text.slice(at, r.start) })
    parts.push({ text: text.slice(r.start, r.end), note: r.note })
    at = r.end
  }
  if (at < text.length || parts.length === 0)
    parts.push({ text: text.slice(at) })
  return parts
}
