import { Search } from 'lucide-react'
import Link from 'next/link'

import { Header } from '@/components/header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listHistory } from '@/lib/assist/history'
import { requireUser } from '@/lib/auth'

import { HistoryItem } from './history-item'

export default async function HistoryPage({
  searchParams,
}: PageProps<'/history'>) {
  const user = await requireUser()
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined
  const { items, nextCursor } = await listHistory(user.id, { q, cursor })

  return (
    <>
      <Header userEmail={user.email} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        <form action="/history" className="flex gap-2">
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

        {items.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {q ? (
              <>No sentences match “{q}”.</>
            ) : (
              <>
                Nothing yet. Sentences you fix show up here.{' '}
                <Link href="/" className="text-foreground underline">
                  Fix one
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
              query: { ...(q && { q }), cursor: nextCursor },
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
