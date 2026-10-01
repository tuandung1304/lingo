import { cn } from 'cn'
import { ChevronDown, Search } from 'lucide-react'
import Link from 'next/link'

import { Header } from '@/components/header'
import { MODE_INK } from '@/components/mode-ink'
import { Scribble } from '@/components/scribble'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listHistory } from '@/lib/assist/history'
import { type Mode, MODE_LABELS, MODES } from '@/lib/assist/schema'
import { requireUser } from '@/lib/auth'

import { Sheet } from '../assist-output'
import { HistoryDays } from './history-days'

const FILTERS: { id?: Mode; label: string }[] = [
  { label: 'All' },
  ...MODES.map((id) => ({ id, label: MODE_LABELS[id] })),
]

export default async function HistoryPage({
  searchParams,
}: PageProps<'/history'>) {
  const user = await requireUser()
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined
  const mode = MODES.find((m) => m === params.mode)
  const { items, nextCursor } = await listHistory(user.id, {
    q,
    cursor,
    mode,
  })

  return (
    <>
      <Header userEmail={user.email} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
        <form action="/history" className="flex gap-2">
          {mode && <input type="hidden" name="mode" value={mode} />}
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search your sentences…"
              aria-label="Search history"
              className="bg-card dark:bg-card h-10 rounded-xl pl-8 text-base md:text-sm"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-10 rounded-xl px-3.5"
          >
            Search
          </Button>
        </form>

        <nav aria-label="Filter by mode" className="-mt-1 -ml-2 flex gap-1">
          {FILTERS.map((f) => {
            const current = f.id === mode
            return (
              <Link
                key={f.label}
                href={{
                  pathname: '/history',
                  query: { ...(q && { q }), ...(f.id && { mode: f.id }) },
                }}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring/50 font-hand relative rounded-md px-2 pt-0.5 pb-2.5 text-[1.45rem] leading-none font-semibold transition-colors outline-none focus-visible:ring-3',
                  current
                    ? f.id
                      ? MODE_INK[f.id].text
                      : 'text-foreground'
                    : 'text-muted-foreground/80 hover:text-foreground',
                )}
              >
                {f.label}
                {current && (
                  <Scribble className="absolute inset-x-1.5 bottom-0.5 w-[calc(100%-0.75rem)]" />
                )}
              </Link>
            )
          })}
        </nav>

        {items.length === 0 ? (
          <Sheet className="o-ly">
            <p className="text-muted-foreground relative px-6 py-14 text-center text-sm text-balance">
              {q ? (
                <>No sentences match “{q}”. Try fewer words.</>
              ) : (
                <>
                  Nothing here yet. Sentences you fix, and replies you get, land
                  on this page.{' '}
                  <Link
                    href="/"
                    className="text-foreground font-medium underline underline-offset-4"
                  >
                    Write your first one
                  </Link>
                </>
              )}
            </p>
          </Sheet>
        ) : (
          <HistoryDays items={items} />
        )}

        {nextCursor && (
          <Link
            href={{
              pathname: '/history',
              query: {
                ...(q && { q }),
                ...(mode && { mode }),
                cursor: nextCursor,
              },
            }}
            className={buttonVariants({
              variant: 'outline',
              className: 'h-9 gap-1.5 self-center rounded-xl px-3.5',
            })}
          >
            <ChevronDown className="size-3.5" />
            Older
          </Link>
        )}
      </main>
    </>
  )
}
