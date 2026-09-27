'use client'

import { cn } from 'cn'
import { ArrowUpRight, Check, Copy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { buildSegments } from '@/lib/assist/highlight'
import type { FixResult, Tone } from '@/lib/assist/schema'

import { Highlighted } from '../assist-output'

interface Props {
  id: string
  input: string
  tone: Tone
  output: FixResult
  createdAt: Date
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function HistoryItem({ id, input, tone, output, createdAt }: Props) {
  const [copied, setCopied] = useState(false)
  const { corrected, alternatives, edits } = output
  const segments =
    edits.length > 0 ? buildSegments(input, corrected, edits) : null
  const rewritten = edits.length === 0 && corrected !== input
  const summary = [
    alternatives.length > 0 && plural(alternatives.length, 'alternative'),
    edits.length > 0 && plural(edits.length, 'edit'),
  ].filter((s): s is string => !!s)

  async function copy() {
    try {
      await navigator.clipboard.writeText(corrected)
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <li className="bg-card hover:border-foreground/20 relative flex flex-col gap-2 rounded-xl border px-4 py-3 transition-colors">
      {rewritten && (
        <p className="text-muted-foreground line-clamp-1 text-sm">{input}</p>
      )}

      <div className="flex items-start gap-3">
        <p className="line-clamp-3 flex-1 leading-relaxed text-pretty">
          {segments ? <Highlighted segments={segments} /> : corrected}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy corrected sentence"
          title="Copy corrected sentence"
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
        {/* Server and browser time zones differ; the browser's value wins */}
        <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
          {createdAt.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </time>
        <span aria-hidden>·</span>
        <span className="capitalize">{tone}</span>
        {summary.map((s) => (
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
