'use client'

import { cn } from 'cn'
import { History, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Pages, not modes: modes switch inside Assist. Mistakes and Review land here later.
const LINKS = [
  { href: '/', label: 'Assist', icon: Sparkles },
  { href: '/history', label: 'History', icon: History },
] as const

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex h-full items-stretch gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className={cn(
            'text-muted-foreground hover:text-foreground relative flex items-center gap-1.5 px-2.5 text-sm font-medium transition-colors',
            'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors',
            'aria-[current=page]:text-foreground aria-[current=page]:after:bg-foreground',
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
