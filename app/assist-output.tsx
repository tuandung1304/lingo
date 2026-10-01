'use client'

import { cn } from 'cn'
import { Check, Copy } from 'lucide-react'

import { Kbd } from '@/components/ui/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Segment } from '@/lib/assist/highlight'
import { markPhrases } from '@/lib/assist/phrases'
import type { EditType, FixEdit, VocabNote } from '@/lib/assist/schema'

export const EDIT_LABELS: Record<EditType, string> = {
  spelling: 'Spelling',
  grammar: 'Grammar',
  word_choice: 'Word choice',
  naturalness: 'Naturalness',
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
      {children}
    </h2>
  )
}

export function StreamCaret() {
  return (
    <span
      aria-hidden
      className="bg-foreground/60 ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse align-text-bottom"
    />
  )
}

// Number key hint that turns into a check once copied
export function CopyHint({
  index,
  copied,
}: {
  index: number
  copied: boolean
}) {
  return (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
      {copied ? (
        <Check className="text-tick size-3.5" />
      ) : (
        <Copy className="size-3.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100" />
      )}
      <Kbd className="hidden sm:inline-flex">{index + 1}</Kbd>
    </span>
  )
}

export function CorrectedSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2" aria-hidden>
      <div className="bg-muted h-5 w-4/5 animate-pulse rounded" />
      <div className="bg-muted h-5 w-3/5 animate-pulse rounded" />
    </div>
  )
}

// The teacher's notes beside the sentence; numbers match the marks above the line
export function EditList({ edits }: { edits: FixEdit[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {edits.map((e, i) => (
        <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-x-2 text-sm">
          <span
            aria-hidden
            className="font-hand text-ink-fix text-xl leading-5 font-semibold"
          >
            {i + 1}
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">
                {e.original && (
                  <span className="text-muted-foreground decoration-ink-fix line-through decoration-2">
                    {e.original}
                  </span>
                )}
                {e.original && e.replacement && (
                  <span className="text-muted-foreground px-1.5">→</span>
                )}
                {e.replacement && (
                  <span className="text-ink-fix">{e.replacement}</span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">
                {EDIT_LABELS[e.type]}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {e.explanation}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

const TRIGGER = <span className="cursor-help" />

// Corrections in red pen: the wrong words struck through, the right ones
// handwritten above the line. `edits` numbers each mark to match EditList;
// `animated` lets the pen draw them in once, right after an answer arrives.
export function Highlighted({
  segments,
  edits,
  animated = false,
}: {
  segments: Segment[]
  edits?: FixEdit[]
  animated?: boolean
}) {
  let mark = 0
  return segments.map((s, i) => {
    if (s.kind === 'same') return <span key={i}>{s.text}</span>

    const removed = s.removed.trim()
    const added = s.added.trim()
    const order = mark++
    const strikeDelay = animated
      ? { animationDelay: `${order * 70}ms` }
      : undefined
    const inkDelay = animated
      ? { animationDelay: `${order * 70 + 160}ms` }
      : undefined
    const number = s.edit && edits ? edits.indexOf(s.edit) + 1 : 0
    const base = removed ? (
      <del
        style={strikeDelay}
        className={cn(
          'text-foreground/55 pen-strike no-underline',
          animated && 'animate-strike',
        )}
      >
        {removed}
      </del>
    ) : (
      // A pure insertion: a caret where the words go in
      <span aria-hidden className="text-ink-fix px-px font-semibold">
        ‸
      </span>
    )
    // Added punctuation is too small to sit above the line; the pen writes it in place
    const inline = !removed && /^\p{P}+$/u.test(added)
    const body = (
      <>
        {inline ? (
          <ins
            style={inkDelay}
            className={cn(
              'text-ink-fix font-hand inline-block text-[1.15em] leading-none font-semibold no-underline',
              animated && 'animate-ink',
            )}
          >
            {added}
          </ins>
        ) : added ? (
          <ruby className="ruby-center">
            {base}
            <rt className="font-hand text-ink-fix pb-0.5 text-[0.95em] leading-none font-semibold">
              <ins
                style={inkDelay}
                className={cn(
                  'inline-block no-underline',
                  animated && 'animate-ink',
                )}
              >
                {added}
              </ins>
              {number > 0 && (
                <sup aria-hidden className="ml-0.5 text-[0.7em]">
                  {number}
                </sup>
              )}
            </rt>
          </ruby>
        ) : (
          base
        )}
        {/\s$/.test(s.added || s.removed) && ' '}
      </>
    )
    if (!s.edit) return <span key={i}>{body}</span>

    return (
      <Tooltip key={i}>
        <TooltipTrigger render={TRIGGER}>{body}</TooltipTrigger>
        <TooltipContent className="flex-col items-start gap-1 py-2">
          <span className="font-medium">{EDIT_LABELS[s.edit.type]}</span>
          <span className="opacity-80">{s.edit.explanation}</span>
        </TooltipContent>
      </Tooltip>
    )
  })
}

const PHRASE_TRIGGER = (
  <span className="decoration-ink-suggest/70 cursor-help underline decoration-wavy decoration-[1.5px] underline-offset-[5px]" />
)

// A suggestion with its vocab phrases underlined; hovering one shows its meaning
export function Phrased({ text, vocab }: { text: string; vocab: VocabNote[] }) {
  return markPhrases(text, vocab).map((part, i) =>
    part.note ? (
      <Tooltip key={i}>
        <TooltipTrigger render={PHRASE_TRIGGER}>{part.text}</TooltipTrigger>
        <TooltipContent className="max-w-72 flex-col items-start gap-1 py-2">
          <span className="font-medium">{part.note.phrase}</span>
          <span className="opacity-80">{part.note.meaning}</span>
        </TooltipContent>
      </Tooltip>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  )
}

// A word list as you'd copy it into the back of the notebook: phrase, then meaning
export function VocabList({ vocab }: { vocab: VocabNote[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[minmax(7rem,max-content)_1fr]">
      {vocab.map((v, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-suggest font-semibold">{v.phrase}</dt>
          <dd className="text-muted-foreground -mt-2 leading-relaxed sm:mt-0">
            {v.meaning}
          </dd>
        </div>
      ))}
    </dl>
  )
}
