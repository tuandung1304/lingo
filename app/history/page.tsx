import { cn } from 'cn'
import { Search } from 'lucide-react'
import Link from 'next/link'

import { Header } from '@/components/header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listHistory } from '@/lib/assist/history'
import { type Mode, MODE_LABELS, MODES } from '@/lib/assist/schema'
import { requireUser } from '@/lib/auth'

import { HistoryItem } from './history-item'

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
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
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
              className="h-9 pl-8"
            />
          </div>
          <Button type="submit" variant="outline" className="h-9">
            Search
          </Button>
        </form>

        <nav aria-label="Filter by mode" className="-mt-1 flex gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={{
                pathname: '/history',
                query: { ...(q && { q }), ...(f.id && { mode: f.id }) },
              }}
              aria-current={f.id === mode ? 'page' : undefined}
              className={cn(
                'text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg px-2.5 py-1 text-sm font-medium transition-colors',
                'aria-[current=page]:bg-muted aria-[current=page]:text-foreground',
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {items.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {q ? (
              <>No sentences match “{q}”.</>
            ) : (
              <>
                Nothing yet. Sentences you fix or get suggestions for show up
                here.{' '}
                <Link href="/" className="text-foreground underline">
                  Try one
                </Link>
              </>
            )}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <HistoryItem key={item.id} {...item} />
            ))}
          </ul>
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
              className: 'self-center',
            })}
          >
            Older
          </Link>
        )}
      </main>
    </>
  )
}
