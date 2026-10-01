'use client'

import { useSyncExternalStore } from 'react'

import type { HistoryItem as Item } from '@/lib/assist/history'

import { Sheet, TEXT_INSET } from '../assist-output'
import { HistoryItem } from './history-item'

const noopSubscribe = () => () => {}

// Days are the browser's, but hydration has to match the server, so the first
// render groups in UTC and the browser regroups straight after
export function HistoryDays({ items }: { items: Item[] }) {
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    () => undefined,
    () => 'UTC',
  )
  const days = groupByDay(items, timeZone)

  return (
    <div className="flex flex-col gap-6 [--margin:3rem] sm:[--margin:3.25rem]">
      {days.map((day) => (
        <section key={day.key} className="flex flex-col gap-2">
          <h2
            className={`text-sm font-semibold ${TEXT_INSET}`}
            suppressHydrationWarning
          >
            {day.label}
          </h2>
          <Sheet>
            <ul className="divide-y">
              {day.items.map((item) => (
                <HistoryItem key={item.id} {...item} timeZone={timeZone} />
              ))}
            </ul>
          </Sheet>
        </section>
      ))}
    </div>
  )
}

function groupByDay(items: Item[], timeZone: string | undefined) {
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone })
  const now = new Date()
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000))

  const days: { key: string; label: string; items: Item[] }[] = []
  for (const item of items) {
    const key = dayKey(item.createdAt)
    let day = days.at(-1)
    if (day?.key !== key) {
      day = {
        key,
        label:
          key === today
            ? 'Today'
            : key === yesterday
              ? 'Yesterday'
              : item.createdAt.toLocaleDateString(undefined, {
                  timeZone,
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  ...(key.slice(0, 4) !== today.slice(0, 4) && {
                    year: 'numeric',
                  }),
                }),
        items: [],
      }
      days.push(day)
    }
    day.items.push(item)
  }
  return days
}
