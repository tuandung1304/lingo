'use client'

import { useObject } from '@ai-sdk/react'
import { cn } from 'cn'
import { ArrowUp, Check, Languages, RotateCw, Square } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { buildSegments } from '@/lib/assist/highlight'
import {
  type AssistRequest,
  type FixEdit,
  type FixResult,
  fixResultSchema,
  TONES,
  type Tone,
} from '@/lib/assist/schema'

import {
  CopyHint,
  CorrectedSkeleton,
  EditList,
  Highlighted,
  SectionLabel,
  StreamCaret,
} from './assist-output'

const MAX_INPUT = 1000

const noopSubscribe = () => () => {}
const isMacClient = () => /Mac|iPhone|iPad/.test(navigator.platform)
const isMacServer = () => true

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

// Tone survives reloads via localStorage; falls back to memory if storage is blocked
const TONE_KEY = 'assist.tone'
const toneListeners = new Set<() => void>()
let savedTone: Tone | undefined
const toneStore = {
  subscribe(listener: () => void) {
    toneListeners.add(listener)
    return () => toneListeners.delete(listener)
  },
  get(): Tone {
    if (!savedTone) {
      try {
        const v = localStorage.getItem(TONE_KEY) as Tone
        savedTone = TONES.includes(v) ? v : 'casual'
      } catch {
        savedTone = 'casual'
      }
    }
    return savedTone
  },
  set(tone: Tone) {
    savedTone = tone
    try {
      localStorage.setItem(TONE_KEY, tone)
    } catch {}
    toneListeners.forEach((l) => l())
  },
}
const serverTone = (): Tone => 'casual'

export function Assist() {
  const [input, setInput] = useState('')
  const tone = useSyncExternalStore(
    toneStore.subscribe,
    toneStore.get,
    serverTone,
  )
  // The input as it was when submitted, so edits to the box don't shift the diff
  const [submitted, setSubmitted] = useState('')
  const [firstByteMs, setFirstByteMs] = useState<number | null>(null)
  const [cached, setCached] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isMac = useSyncExternalStore(noopSubscribe, isMacClient, isMacServer)

  // Records time to the first streamed byte, the latency that matters mid-conversation
  async function timedFetch(url: RequestInfo | URL, init?: RequestInit) {
    const start = performance.now()
    const res = await fetch(url, init)
    setCached(res.headers.get('x-assist-cache') === 'hit')
    if (!res.body) return res
    let seen = false
    const body = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          if (!seen) {
            seen = true
            setFirstByteMs(Math.round(performance.now() - start))
          }
          controller.enqueue(chunk)
        },
      }),
    )
    return new Response(body, res)
  }

  const { object, submit, isLoading, stop, error } = useObject<
    typeof fixResultSchema,
    FixResult,
    AssistRequest
  >({ api: '/api/assist', schema: fixResultSchema, fetch: timedFetch })

  const corrected = object?.corrected ?? ''
  const options = [corrected, ...(object?.alternatives ?? [])].filter(
    (s): s is string => !!s,
  )
  const edits = (object?.edits ?? []).filter(isCompleteEdit)
  const done = !isLoading && !!corrected
  // No edits means a rewrite (e.g. Vietnamese input), where a diff is just noise
  const segments =
    done && edits.length > 0 ? buildSegments(submitted, corrected, edits) : null

  function run(text: string, fresh: boolean) {
    setSubmitted(text)
    setFirstByteMs(null)
    setCached(false)
    setCopied(null)
    submit({ mode: 'fix', input: text, tone, ...(fresh && { fresh }) })
  }

  function send() {
    const text = input.trim()
    if (!text || isLoading) return
    run(text, false)
    // Leave the box so 1/2/3 copy right away; `/` comes back
    inputRef.current?.blur()
  }

  // Same submitted text, current tone, bypassing the cache
  function regenerate() {
    if (!submitted || isLoading) return
    run(submitted, true)
  }

  async function copy(index: number) {
    const text = options[index]
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    setCopied(index)
    setTimeout(() => setCopied((c) => (c === index ? null : c)), 1500)
  }

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) return

    if (e.key === 'Escape' && isLoading) {
      e.preventDefault()
      stop()
      return
    }

    const digit = /^Digit([1-3])$/.exec(e.code)?.[1]
    if (digit && (e.altKey || !isTyping(e.target))) {
      e.preventDefault()
      void copy(Number(digit) - 1)
      return
    }

    if (e.key === 'r' && !e.altKey && !isTyping(e.target) && done) {
      e.preventDefault()
      regenerate()
      return
    }

    if (e.key === '/' && !isTyping(e.target)) {
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  })

  useEffect(() => {
    inputRef.current?.focus()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const mod = isMac ? '⌘' : 'Ctrl'
  const alt = isMac ? '⌥' : 'Alt+'
  const alternatives = options.slice(1)
  const unchanged = done && edits.length === 0 && corrected === submitted
  const rewritten = done && edits.length === 0 && corrected !== submitted

  return (
    <div className="flex flex-col gap-6">
      <form
        className="bg-card focus-within:border-ring focus-within:ring-ring/30 rounded-xl border shadow-xs transition-[color,box-shadow] focus-within:ring-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              send()
            } else if (e.key === 'Escape' && !isLoading) {
              e.currentTarget.blur()
            }
          }}
          placeholder="Type what you want to say…"
          aria-label="Sentence to fix"
          className="max-h-60 min-h-24 resize-none border-0 bg-transparent px-4 pt-3 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
          maxLength={MAX_INPUT}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <ToggleGroup
            size="sm"
            spacing={1}
            value={[tone]}
            onValueChange={(v) => v[0] && toneStore.set(v[0] as Tone)}
            aria-label="Tone"
            className="bg-muted rounded-lg p-0.5"
          >
            {TONES.map((t) => (
              <ToggleGroupItem
                key={t}
                value={t}
                className="text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground h-6 px-2.5 capitalize aria-pressed:shadow-xs"
              >
                {t}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-2">
            {input.length > MAX_INPUT * 0.8 && (
              <span className="text-muted-foreground text-xs tabular-nums">
                {input.length}/{MAX_INPUT}
              </span>
            )}
            {isLoading ? (
              <Button type="button" variant="outline" onClick={() => stop()}>
                <Square className="fill-current" /> Stop
                <Kbd>Esc</Kbd>
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
                <ArrowUp /> Fix
                <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                  {mod}↵
                </Kbd>
              </Button>
            )}
          </div>
        </div>
      </form>

      <div className="text-muted-foreground -mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
        <span className="flex items-center gap-1.5">
          <Kbd>{mod}↵</Kbd> Fix
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>1</Kbd>–<Kbd>3</Kbd> Copy
          <span className="opacity-70">({alt}1 while typing)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>/</Kbd> Edit
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>R</Kbd> Regenerate
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Esc</Kbd> Stop
        </span>
      </div>

      {error && (
        <p
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm"
          role="alert"
        >
          Something went wrong. Try again.
        </p>
      )}

      {isLoading && !corrected && <CorrectedSkeleton />}

      {corrected && (
        <section className="flex flex-col gap-5" aria-live="polite">
          <div className="flex flex-col gap-2">
            <SectionLabel>
              Corrected
              {unchanged && (
                <span className="flex items-center gap-1 tracking-normal text-emerald-600 normal-case dark:text-emerald-400">
                  <Check className="size-3.5" /> Looks good
                </span>
              )}
              {rewritten && (
                <span className="flex items-center gap-1 tracking-normal normal-case">
                  <Languages className="size-3.5" /> Rewritten in English
                </span>
              )}
              <span className="ml-auto flex items-center gap-2 font-normal tracking-normal normal-case">
                {firstByteMs !== null && (
                  <span className="tabular-nums">
                    {cached && 'cached · '}
                    {firstByteMs} ms
                  </span>
                )}
                {done && (
                  <button
                    type="button"
                    onClick={regenerate}
                    aria-label="Regenerate"
                    title="Regenerate (R)"
                    className="hover:bg-muted hover:text-foreground -my-1 rounded-md p-1"
                  >
                    <RotateCw className="size-3.5" />
                  </button>
                )}
              </span>
            </SectionLabel>
            <div
              className={cn(
                'group bg-card flex items-start gap-3 rounded-xl border p-4 transition-colors',
                copied === 0 && 'border-emerald-500/40',
              )}
            >
              <p className="flex-1 text-lg leading-relaxed text-pretty">
                {segments ? <Highlighted segments={segments} /> : corrected}
                {isLoading && <StreamCaret />}
              </p>
              <button
                type="button"
                onClick={() => copy(0)}
                aria-label="Copy corrected sentence"
                className="hover:bg-muted -m-1 rounded-md p-1"
              >
                <CopyHint index={0} copied={copied === 0} />
              </button>
            </div>
          </div>

          {alternatives.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel>More natural</SectionLabel>
              {alternatives.map((text, j) => {
                const i = j + 1
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => copy(i)}
                    className={cn(
                      'group bg-card hover:bg-muted/50 flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                      copied === i && 'border-emerald-500/40',
                    )}
                  >
                    <span className="flex-1 leading-relaxed text-pretty">
                      {text}
                    </span>
                    <CopyHint index={i} copied={copied === i} />
                  </button>
                )
              })}
            </div>
          )}

          {done && edits.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel>Why</SectionLabel>
              <EditList edits={edits} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function isCompleteEdit(e: Partial<FixEdit> | undefined): e is FixEdit {
  return (
    typeof e?.original === 'string' &&
    typeof e.replacement === 'string' &&
    typeof e.explanation === 'string' &&
    !!e.type
  )
}
