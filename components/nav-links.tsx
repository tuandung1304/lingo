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
    <nav aria-label="Main" className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className={cn(
            'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
            'aria-[current=page]:bg-muted aria-[current=page]:text-foreground aria-[current=page]:font-semibold',
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
