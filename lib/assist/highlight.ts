import { diffWords } from 'diff'

import type { FixEdit } from './schema'

export type Segment =
  | { kind: 'same'; text: string }
  | { kind: 'change'; removed: string; added: string; edit?: FixEdit }

// Word-level diff between what the user typed and the corrected sentence.
// Positions come from the diff, never from the model; the model's edits are
// only matched in afterwards to attach explanations.
export function buildSegments(
  input: string,
  corrected: string,
  edits: FixEdit[],
): Segment[] {
  const segments: Segment[] = []
  let pending: { removed: string; added: string } | null = null

  const flush = () => {
    if (!pending) return
    segments.push({
      kind: 'change',
      ...pending,
      edit: matchEdit(pending.removed, pending.added, edits),
    })
    pending = null
  }

  for (const part of diffWords(input, corrected)) {
    if (!part.added && !part.removed) {
      flush()
      segments.push({ kind: 'same', text: part.value })
      continue
    }
    pending ??= { removed: '', added: '' }
    if (part.removed) pending.removed += part.value
    else pending.added += part.value
  }
  flush()

  return segments
}

const norm = (s: string) => s.trim().toLowerCase()
const overlaps = (x: string, y: string) =>
  !!x && !!y && (x.includes(y) || y.includes(x))

function matchEdit(removed: string, added: string, edits: FixEdit[]) {
  const r = norm(removed)
  const a = norm(added)
  return (
    edits.find((e) => norm(e.original) === r && norm(e.replacement) === a) ??
    edits.find(
      (e) => overlaps(norm(e.original), r) && overlaps(norm(e.replacement), a),
    ) ??
    edits.find(
      (e) => overlaps(norm(e.original), r) || overlaps(norm(e.replacement), a),
    )
  )
}
