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

import { MODE_INK } from '@/components/mode-ink'
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
  type WriteResult,
} from '@/lib/assist/schema'

import {
  CopyHint,
  CopyIcon,
  CorrectedSkeleton,
  EditList,
  Highlighted,
  LINE,
  Phrased,
  SectionLabel,
  Sheet,
  StreamCaret,
  TEXT_INSET,
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
  write: {
    inputLabel: 'What you want it to do',
    placeholder: 'Describe what to write…',
  },
}

export type AssistSession = {
  input: string
  tone: Tone
  createdAt: Date
} & (
  | { mode: 'fix'; output: FixResult }
  | { mode: 'suggest'; output: SuggestResult }
  | { mode: 'write'; output: WriteResult }
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
    mode === 'suggest' || mode === 'write'
      ? (object as DeepPartial<SuggestResult | WriteResult> | undefined)
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
    if (digit && !e.altKey && !isTyping(e.target)) {
      e.preventDefault()
      void copy(Number(digit) - 1)
      return
    }

    if (e.key === 'r' && !e.altKey && !isTyping(e.target) && done) {
      e.preventDefault()
      regenerate()
      return
    }

    // With nothing focused; the input box handles its own Tab
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

  const mod = isMac ? '⌘' : 'Ctrl+'
  const enter = isMac ? '↵' : 'Enter'
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

  const ink = MODE_INK[mode]

  return (
    <div className="flex flex-col gap-6 [--margin:2.25rem] sm:[--margin:2.75rem]">
      <div className="-mb-2">
        <ModeTabs value={mode} onChange={changeMode} />
      </div>
      <form
        className={cn(
          'bg-card o-ly relative overflow-hidden rounded-xl border transition-[border-color,box-shadow] focus-within:ring-4',
          ink.focus,
        )}
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
            } else if (
              e.key === 'Tab' &&
              !e.nativeEvent.isComposing &&
              !e.altKey &&
              !e.ctrlKey &&
              !e.metaKey
            ) {
              // Switch mode without leaving the box; Esc leaves it
              e.preventDefault()
              cycleMode(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Escape' && !isLoading) {
              e.currentTarget.blur()
            }
          }}
          placeholder={copyText.placeholder}
          aria-label={copyText.inputLabel}
          className="max-h-60 min-h-28 resize-none rounded-none border-0 bg-transparent px-4 pt-3.5 text-base leading-relaxed shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
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
          >
            {TONES.map((t) => (
              <ToggleGroupItem
                key={t}
                value={t}
                className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground hover:text-foreground h-7 rounded-full px-2.5 capitalize hover:bg-transparent aria-pressed:font-semibold"
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
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3"
                onClick={() => stop()}
              >
                <Square className="fill-current" /> Stop
                <Kbd className="hidden sm:inline-flex">Esc</Kbd>
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                className={cn('h-9 px-3 font-semibold', ink.button)}
              >
                <ArrowUp strokeWidth={2.5} /> {MODE_LABELS[mode]}
                <Kbd className="hidden bg-current/0 text-current opacity-75 sm:inline-flex">
                  {mod}
                  {enter}
                </Kbd>
              </Button>
            )}
          </div>
        </div>
      </form>

      <div className="text-muted-foreground -mt-3 hidden flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs sm:flex">
        <span className="flex items-center gap-1.5">
          <Kbd>Tab</Kbd> Mode
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>1</Kbd>–<Kbd>3</Kbd> Copy
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

      {isLoading && options.length === 0 && <CorrectedSkeleton mode={mode} />}

      {mode === 'fix' && corrected && (
        <section className="flex flex-col gap-5" aria-live="polite">
          <div className="flex flex-col gap-2">
            <SectionLabel>
              Corrected
              {unchanged && (
                <span className="text-tick flex items-center gap-1">
                  <Check className="size-3.5" strokeWidth={2.5} /> Looks good
                </span>
              )}
              {rewritten && (
                <span className="flex items-center gap-1">
                  <Languages className="size-3.5" /> Rewritten in English
                </span>
              )}
              {meta}
            </SectionLabel>
            <Sheet mode={mode}>
              <div className={cn('group', LINE, segments && 'pt-5')}>
                <CopyHint
                  index={0}
                  copied={copied === 0}
                  className={cn(segments && 'mt-5')}
                />
                <p
                  className={cn(
                    'text-lg text-pretty sm:text-xl',
                    segments ? 'leading-[2.3]' : 'leading-relaxed',
                  )}
                >
                  {segments ? (
                    // Marks above the line scramble reading order, so screen readers get the plain sentence
                    <>
                      <span className="sr-only">{corrected}</span>
                      <span aria-hidden>
                        <Highlighted
                          segments={segments}
                          edits={edits}
                          animated
                        />
                      </span>
                    </>
                  ) : (
                    corrected
                  )}
                  {isLoading && <StreamCaret />}
                </p>
                <button
                  type="button"
                  onClick={() => copy(0)}
                  aria-label="Copy corrected sentence"
                  title="Copy (1)"
                  className={cn(
                    'hover:bg-muted focus-visible:ring-ring/50 -m-1 rounded-md p-1 outline-none focus-visible:ring-3',
                    segments && 'mt-4',
                  )}
                >
                  <CopyIcon />
                </button>
              </div>

              {alternatives.length > 0 && (
                <div className="border-t">
                  <p
                    className={cn(
                      'text-muted-foreground pt-3 -mb-1 text-sm',
                      TEXT_INSET,
                    )}
                  >
                    More natural
                  </p>
                  {alternatives.map((text, j) => {
                    const i = j + 1
                    return (
                      <OptionLine
                        key={i}
                        index={i}
                        label={`Copy alternative ${j + 1}`}
                        copied={copied === i}
                        onCopy={copy}
                      >
                        <span className="leading-relaxed sm:text-lg">
                          {text}
                        </span>
                      </OptionLine>
                    )
                  })}
                </div>
              )}
            </Sheet>
          </div>

          {done && edits.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Why</SectionLabel>
              <EditList edits={edits} />
            </div>
          )}
        </section>
      )}

      {(mode === 'suggest' || mode === 'write') && suggestions.length > 0 && (
        <section className="flex flex-col gap-5" aria-live="polite">
          <div className="flex flex-col gap-2">
            <SectionLabel>
              {mode === 'write' ? 'Here it is' : 'Say it like this'}
              {meta}
            </SectionLabel>
            <Sheet mode={mode} className="divide-y">
              {suggestions.map((text, i) => (
                <OptionLine
                  key={i}
                  index={i}
                  label={`Copy ${mode === 'write' ? 'reply' : 'suggestion'} ${i + 1}`}
                  copied={copied === i}
                  onCopy={copy}
                >
                  <span className="leading-relaxed sm:text-lg">
                    {done ? <Phrased text={text} vocab={vocab} /> : text}
                    {isLoading && i === suggestions.length - 1 && (
                      <StreamCaret />
                    )}
                  </span>
                </OptionLine>
              ))}
            </Sheet>
          </div>

          {done && vocab.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <SectionLabel>Words &amp; phrases</SectionLabel>
              <VocabList vocab={vocab} />
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// One line on the sheet: the number in the margin, the sentence, a copy button.
// Only the button copies, so text can still be selected or hovered for meanings.
function OptionLine({
  index,
  label,
  copied,
  onCopy,
  children,
}: {
  index: number
  label: string
  copied: boolean
  onCopy: (index: number) => void
  children: React.ReactNode
}) {
  return (
    <div className={cn('group text-pretty', LINE)}>
      <CopyHint index={index} copied={copied} />
      {children}
      <button
        type="button"
        onClick={() => onCopy(index)}
        aria-label={label}
        title={`Copy (${index + 1})`}
        className="hover:bg-muted focus-visible:ring-ring/50 -m-1 rounded-md p-1 outline-none focus-visible:ring-3"
      >
        <CopyIcon />
      </button>
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
