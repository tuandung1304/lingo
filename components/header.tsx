import Link from 'next/link'

import { AccountMenu } from './account-menu'
import { Logo } from './logo'
import { NavLinks } from './nav-links'

interface Props {
  userEmail: string
}

export function Header({ userEmail }: Props) {
  return (
    <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center gap-3 px-4">
        <Link href="/" aria-label="Lingo" className="shrink-0">
          <Logo />
        </Link>
        <NavLinks />
        <div className="ml-auto">
          <AccountMenu email={userEmail} />
        </div>
      </div>
    </header>
  )
}
