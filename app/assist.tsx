'use client'

import { useObject } from '@ai-sdk/react'
import type { DeepPartial } from 'ai'
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
  type AssistResult,
  assistResultSchema,
  type FixEdit,
  type FixResult,
  type Mode,
  MODE_LABELS,
  MODES,
  type SuggestResult,
  TONES,
  type Tone,
  type VocabNote,
} from '@/lib/assist/schema'

import {
  CopyHint,
  CorrectedSkeleton,
  EditList,
  Highlighted,
  Phrased,
  SectionLabel,
  StreamCaret,
  VocabList,
} from './assist-output'
import { ModeTabs } from './mode-tabs'

const MAX_INPUT = 1000

const noopSubscribe = () => () => {}
const isMacClient = () => /Mac|iPhone|iPad/.test(navigator.platform)
const isMacServer = () => true

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

// Tone and mode survive reloads via localStorage; fall back to memory if storage is blocked
function storedChoice<T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
) {
  const listeners = new Set<() => void>()
  let saved: T | undefined
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    get(): T {
      try {
        const v = localStorage.getItem(key) as T
        if (values.includes(v)) return v
      } catch {}
      return saved ?? fallback
    },
    getServer: () => fallback,
    set(value: T) {
      try {
        localStorage.setItem(key, value)
      } catch {
        saved = value
      }
      listeners.forEach((l) => l())
    },
  }
}
const toneStore = storedChoice<Tone>('assist.tone', TONES, 'casual')
const modeStore = storedChoice<Mode>('assist.mode', MODES, 'fix')

const MODE_COPY: Record<Mode, { inputLabel: string; placeholder: string }> = {
  fix: {
    inputLabel: 'Sentence to fix',
    placeholder: 'Type what you want to say…',
  },
  suggest: {
    inputLabel: 'What you want to say',
    placeholder: 'Describe it in Vietnamese, or type a few English words…',
  },
}

export type AssistSession = {
  input: string
  tone: Tone
  createdAt: Date
} & (
  | { mode: 'fix'; output: FixResult }
  | { mode: 'suggest'; output: SuggestResult }
)

export function Assist({ session }: { session?: AssistSession | null }) {
  const [input, setInput] = useState(session?.input ?? '')
  const preferredMode = useSyncExternalStore(
    modeStore.subscribe,
    modeStore.get,
    modeStore.getServer,
  )
  const [sessionMode, setSessionMode] = useState(session?.mode)
  const mode = sessionMode ?? preferredMode
  const preferredTone = useSyncExternalStore(
    toneStore.subscribe,
    toneStore.get,
    toneStore.getServer,
  )
  const [sessionTone, setSessionTone] = useState(session?.tone)
  const tone = sessionTone ?? preferredTone
  // The input as it was when submitted, so edits to the box don't shift the diff
  const [submitted, setSubmitted] = useState(session?.input ?? '')
  const [savedAt, setSavedAt] = useState(session?.createdAt)
  const [firstByteMs, setFirstByteMs] = useState<number | null>(null)
  const [cached, setCached] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isMac = useSyncExternalStore(noopSubscribe, isMacClient, isMacServer)

  const responseSession = useRef<string | null>(null)

  // Records time to the first streamed byte, the latency that matters mid-conversation
  async function timedFetch(url: RequestInfo | URL, init?: RequestInit) {
    const start = performance.now()
    const res = await fetch(url, init)
    setCached(res.headers.get('x-assist-cache') === 'hit')
    responseSession.current = res.headers.get('x-assist-session')
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

  const { object, submit, isLoading, stop, clear, error } = useObject<
    typeof assistResultSchema,
    AssistResult,
    AssistRequest
  >({
    api: '/api/assist',
    schema: assistResultSchema,
    fetch: timedFetch,
    // The server saves a finished answer under this id, so a reload or a shared link reopens it
    onFinish({ object: finished }) {
      if (finished && responseSession.current) {
        window.history.replaceState(
          null,
          '',
          `/?session=${encodeURIComponent(responseSession.current)}`,
        )
      }
    },
    initialValue: session?.output,
  })

  // Switching modes clears the object, so it always has the current mode's shape
  const fix =
    mode === 'fix' ? (object as DeepPartial<FixResult> | undefined) : undefined
  const suggest =
    mode === 'suggest'
      ? (object as DeepPartial<SuggestResult> | undefined)
      : undefined

  const corrected = fix?.corrected ?? ''
  const edits = (fix?.edits ?? []).filter(isCompleteEdit)
  const suggestions = (suggest?.suggestions ?? []).filter(
    (s): s is string => !!s,
  )
  const vocab = (suggest?.vocab ?? []).filter(isCompleteVocab)
  // What 1/2/3 copy
  const options =
    mode === 'fix'
      ? [corrected, ...(fix?.alternatives ?? [])].filter(
          (s): s is string => !!s,
        )
      : suggestions
  const done = !isLoading && options.length > 0
  // No edits means a rewrite (e.g. Vietnamese input), where a diff is just noise
  const segments =
    done && edits.length > 0 ? buildSegments(submitted, corrected, edits) : null

  // The shown result is no longer the linked session; drop ?session= until the next one is saved
  function resetResult() {
    setSavedAt(undefined)
    responseSession.current = null
    if (new URLSearchParams(window.location.search).has('session')) {
      window.history.replaceState(null, '', '/')
    }
    setFirstByteMs(null)
    setCached(false)
    setCopied(null)
  }

  function run(text: string, fresh: boolean) {
    resetResult()
    setSubmitted(text)
    submit({ mode, input: text, tone, ...(fresh && { fresh }) })
  }

  // Keeps the typed input but drops the other mode's result
  function changeMode(next: Mode) {
    if (next === mode) return
    stop()
    clear()
    resetResult()
    setSubmitted('')
    setSessionMode(undefined)
    modeStore.set(next)
    inputRef.current?.focus()
  }

  function cycleMode(step: 1 | -1) {
    const i = MODES.indexOf(mode)
    changeMode(MODES[(i + step + MODES.length) % MODES.length])
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

    // Only with nothing focused, so Tab still moves between buttons and fields
    if (e.key === 'Tab' && !e.altKey && e.target === document.body) {
      e.preventDefault()
      cycleMode(e.shiftKey ? -1 : 1)
      return
    }

    if (e.key === '/' && !isTyping(e.target)) {
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  })

  // An opened session leaves focus off the box so 1/2/3 copy right away
  const focusOnMount = useRef(!session)
  useEffect(() => {
    if (focusOnMount.current) inputRef.current?.focus()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const mod = isMac ? '⌘' : 'Ctrl'
  const alt = isMac ? '⌥' : 'Alt+'
  const copyText = MODE_COPY[mode]
  const alternatives = mode === 'fix' ? options.slice(1) : []
  const unchanged = done && edits.length === 0 && corrected === submitted
  const rewritten = done && edits.length === 0 && corrected !== submitted

  const meta = (
    <span className="ml-auto flex items-center gap-2 font-normal tracking-normal normal-case">
      {savedAt && (
        <time dateTime={savedAt.toISOString()} suppressHydrationWarning>
          Saved{' '}
          {savedAt.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </time>
      )}
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
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="-mb-3">
        <ModeTabs value={mode} onChange={changeMode} />
      </div>
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
          placeholder={copyText.placeholder}
          aria-label={copyText.inputLabel}
          className="max-h-60 min-h-24 resize-none border-0 bg-transparent px-4 pt-3 text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
          maxLength={MAX_INPUT}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <ToggleGroup
            size="sm"
            spacing={1}
            value={[tone]}
            onValueChange={(v) => {
              if (!v[0]) return
              setSessionTone(undefined)
              toneStore.set(v[0] as Tone)
            }}
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
                <ArrowUp /> {MODE_LABELS[mode]}
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
          <Kbd>{mod}↵</Kbd> {MODE_LABELS[mode]}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>Tab</Kbd> Mode
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

      {isLoading && options.length === 0 && <CorrectedSkeleton />}

      {mode === 'fix' && corrected && (
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
              {meta}
            </SectionLabel>
            <div
              className={cn(
                'group bg-card ring-foreground/5 flex items-start gap-3 rounded-xl border p-4 shadow-sm ring-1 transition-colors',
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

      {mode === 'suggest' && suggestions.length > 0 && (
        <section className="flex flex-col gap-5" aria-live="polite">
          <div className="flex flex-col gap-2">
            <SectionLabel>
              Say it like this
              {meta}
            </SectionLabel>
            {suggestions.map((text, i) => (
              <button
                key={i}
                type="button"
                onClick={() => copy(i)}
                className={cn(
                  'group bg-card hover:bg-muted/50 flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  copied === i && 'border-emerald-500/40',
                )}
              >
                <span className="flex-1 text-lg leading-relaxed text-pretty">
                  {done ? <Phrased text={text} vocab={vocab} /> : text}
                  {isLoading && i === suggestions.length - 1 && <StreamCaret />}
                </span>
                <CopyHint index={i} copied={copied === i} />
              </button>
            ))}
          </div>

          {done && vocab.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionLabel>Words &amp; phrases</SectionLabel>
              <VocabList vocab={vocab} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function isCompleteVocab(v: Partial<VocabNote> | undefined): v is VocabNote {
  return typeof v?.phrase === 'string' && typeof v.meaning === 'string'
}

function isCompleteEdit(e: Partial<FixEdit> | undefined): e is FixEdit {
  return (
    typeof e?.original === 'string' &&
    typeof e.replacement === 'string' &&
    typeof e.explanation === 'string' &&
    !!e.type
  )
}
