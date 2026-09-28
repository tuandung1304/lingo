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

const EDIT_COLORS: Record<EditType, string> = {
  spelling: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  grammar: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  word_choice: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  naturalness: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground flex items-center gap-2 px-1 text-xs font-medium tracking-wide uppercase">
      {children}
    </h2>
  )
}

export function TypeBadge({ type }: { type: EditType }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        EDIT_COLORS[type],
      )}
    >
      {EDIT_LABELS[type]}
    </span>
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
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
      <Kbd>{index + 1}</Kbd>
    </span>
  )
}

export function CorrectedSkeleton() {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="bg-muted h-3 w-20 animate-pulse rounded" />
      <div className="bg-muted h-5 w-4/5 animate-pulse rounded" />
    </div>
  )
}

export function EditList({ edits }: { edits: FixEdit[] }) {
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {edits.map((e, i) => (
        <li key={i} className="flex flex-col gap-1.5 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={e.type} />
            <span className="font-medium">
              {e.original && (
                <span className="text-muted-foreground line-through decoration-rose-500/60">
                  {e.original}
                </span>
              )}
              {e.original && e.replacement && (
                <span className="text-muted-foreground px-1.5">→</span>
              )}
              {e.replacement && (
                <span className="text-emerald-700 dark:text-emerald-400">
                  {e.replacement}
                </span>
              )}
            </span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {e.explanation}
          </p>
        </li>
      ))}
    </ul>
  )
}

const TRIGGER = <span className="cursor-help" />

export function Highlighted({ segments }: { segments: Segment[] }) {
  return segments.map((s, i) => {
    if (s.kind === 'same') return <span key={i}>{s.text}</span>

    const removed = s.removed.trim()
    const added = s.added.trim()
    const body = (
      <>
        {removed && (
          <del className="rounded-sm bg-rose-500/10 px-0.5 text-rose-700/80 decoration-rose-500/60 dark:text-rose-300/80">
            {removed}
          </del>
        )}
        {removed && added && ' '}
        {added && (
          <ins className="rounded-sm bg-emerald-500/15 px-0.5 font-medium text-emerald-700 no-underline dark:text-emerald-300">
            {added}
          </ins>
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
  <span className="cursor-help underline decoration-sky-500/60 decoration-dotted decoration-2 underline-offset-4" />
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

export function VocabList({ vocab }: { vocab: VocabNote[] }) {
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {vocab.map((v, i) => (
        <li key={i} className="flex flex-col gap-1 px-4 py-3 text-sm">
          <span className="font-medium text-sky-700 dark:text-sky-300">
            {v.phrase}
          </span>
          <p className="text-muted-foreground leading-relaxed">{v.meaning}</p>
        </li>
      ))}
    </ul>
  )
}
