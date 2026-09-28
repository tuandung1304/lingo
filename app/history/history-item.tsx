'use client'

import { cn } from 'cn'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { buildSegments } from '@/lib/assist/highlight'
import type { HistoryItem as Item } from '@/lib/assist/history'
import { type Mode, MODE_LABELS } from '@/lib/assist/schema'

import { Highlighted, Phrased } from '../assist-output'

const MODE_COLORS: Record<Mode, string> = {
  fix: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  suggest: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function HistoryItem(item: Item) {
  const [copied, setCopied] = useState(false)
  const { id, input, mode, tone, createdAt } = item

  let body: React.ReactNode
  let copyText: string
  let showInput: boolean
  let summary: (string | false)[]
  if (item.mode === 'fix') {
    const { corrected, alternatives, edits } = item.output
    const segments =
      edits.length > 0 ? buildSegments(input, corrected, edits) : null
    body = segments ? <Highlighted segments={segments} /> : corrected
    copyText = corrected
    showInput = edits.length === 0 && corrected !== input
    summary = [
      alternatives.length > 0 && plural(alternatives.length, 'alternative'),
      edits.length > 0 && plural(edits.length, 'edit'),
    ]
  } else {
    const { suggestions, vocab } = item.output
    body = <Phrased text={suggestions[0] ?? ''} vocab={vocab} />
    copyText = suggestions[0] ?? ''
    showInput = true
    summary = [
      suggestions.length > 1 && plural(suggestions.length, 'suggestion'),
      vocab.length > 0 && plural(vocab.length, 'phrase'),
    ]
  }
  const copyLabel =
    mode === 'fix' ? 'Copy corrected sentence' : 'Copy first suggestion'

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText)
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <li className="bg-card hover:border-foreground/20 relative flex flex-col gap-2 rounded-xl border px-4 py-3 transition-colors">
      {showInput && (
        <p className="text-muted-foreground line-clamp-1 text-sm">{input}</p>
      )}

      <div className="flex items-start gap-3">
        <p className="line-clamp-3 flex-1 leading-relaxed text-pretty">
          {body}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={copyLabel}
          title={copyLabel}
          className={cn(
            'text-muted-foreground hover:bg-muted hover:text-foreground relative z-10 -m-1 shrink-0 rounded-md p-1',
            copied && 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>

      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 font-medium',
            MODE_COLORS[mode],
          )}
        >
          {MODE_LABELS[mode]}
        </span>
        {/* Server and browser time zones differ; the browser's value wins */}
        <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
          {createdAt.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </time>
        <span aria-hidden>·</span>
        <span className="capitalize">{tone}</span>
        {summary
          .filter((s): s is string => !!s)
          .map((s) => (
            <span key={s} className="hidden sm:contents">
              <span aria-hidden>·</span>
              <span>{s}</span>
            </span>
          ))}
        <Link
          href={{ pathname: '/', query: { session: id } }}
          className="hover:text-foreground focus-visible:ring-ring/50 ml-auto flex items-center gap-0.5 rounded-md outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:ring-3"
        >
          Open <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </li>
  )
}
