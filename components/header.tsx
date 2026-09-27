import { LogOut } from 'lucide-react'

import { logout } from '@/app/login/actions'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'

import { Logo } from './logo'

interface Props {
  userEmail: string
}

export function Header({ userEmail }: Props) {
  return (
    <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center gap-2 px-4">
        <Logo />
        <h1 className="text-sm font-semibold">English Assist</h1>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-muted-foreground mr-1 hidden truncate text-xs sm:inline">
            {userEmail}
          </span>
          <ModeToggle />
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
