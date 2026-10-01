'use client'

import { cn } from 'cn'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { MODE_INK } from '@/components/mode-ink'
import { buildSegments } from '@/lib/assist/highlight'
import type { HistoryItem as Item } from '@/lib/assist/history'
import { MODE_LABELS } from '@/lib/assist/schema'

import { Highlighted, LINE, Phrased } from '../assist-output'

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

export function HistoryItem({
  timeZone,
  ...item
}: Item & { timeZone?: string }) {
  const [copied, setCopied] = useState(false)
  const { id, input, mode, tone, createdAt } = item
  let marked = false

  let body: React.ReactNode
  let copyText: string
  let showInput: boolean
  let summary: (string | false)[]
  if (item.mode === 'fix') {
    const { corrected, alternatives, edits } = item.output
    const segments =
      edits.length > 0 ? buildSegments(input, corrected, edits) : null
    marked = !!segments
    body = segments ? <Highlighted segments={segments} /> : corrected
    copyText = corrected
    showInput = edits.length === 0 && corrected !== input
    summary = [
      alternatives.length > 0 && plural(alternatives.length, 'alternative'),
      edits.length > 0 && plural(edits.length, 'edit'),
    ]
  } else {
    const { suggestions, vocab } = item.output
    const [one, many] =
      item.mode === 'write' ? ['reply', 'replies'] : ['suggestion', undefined]
    body = <Phrased text={suggestions[0] ?? ''} vocab={vocab} />
    copyText = suggestions[0] ?? ''
    showInput = true
    summary = [
      suggestions.length > 1 && plural(suggestions.length, one, many),
      vocab.length > 0 && plural(vocab.length, 'phrase'),
    ]
  }
  const copyLabel =
    mode === 'fix'
      ? 'Copy corrected sentence'
      : mode === 'write'
        ? 'Copy first reply'
        : 'Copy first suggestion'

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
    <li
      className={cn('group hover:bg-muted/40 relative transition-colors', LINE)}
    >
      {/* Server and browser time zones differ; the browser's value wins */}
      <time
        dateTime={createdAt.toISOString()}
        title={createdAt.toLocaleString(undefined, {
          timeZone,
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
        suppressHydrationWarning
        className={cn(
          'text-muted-foreground pt-1 text-center text-xs tabular-nums',
          marked && 'pt-5',
        )}
      >
        {createdAt.toLocaleTimeString(undefined, {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })}
      </time>

      <div className="flex min-w-0 flex-col gap-1.5">
        {showInput && (
          <p className="text-muted-foreground line-clamp-1 text-sm">{input}</p>
        )}
        <p
          className={cn(
            'line-clamp-3 text-pretty',
            marked ? 'leading-[2.2]' : 'leading-relaxed',
          )}
        >
          {body}
        </p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 font-semibold',
              MODE_INK[mode].badge,
            )}
          >
            {MODE_LABELS[mode]}
          </span>
          <span className="capitalize">{tone}</span>
          {summary
            .filter((s): s is string => !!s)
            .map((s) => (
              <span key={s} className="hidden sm:inline">
                {s}
              </span>
            ))}
          <Link
            href={{ pathname: '/', query: { session: id } }}
            className="hover:text-foreground focus-visible:ring-ring/50 ml-auto flex items-center gap-0.5 rounded-md outline-none after:absolute after:inset-0 focus-visible:ring-3"
          >
            Open <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={copy}
        aria-label={copyLabel}
        title={copyLabel}
        className={cn(
          'text-muted-foreground hover:bg-muted hover:text-foreground relative z-10 -m-1 mt-0 shrink-0 rounded-md p-1',
          marked && 'mt-4',
          copied && 'text-tick',
        )}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </li>
  )
}
