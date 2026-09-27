import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'

interface Props {
  userEmail: string
  onLogout: () => void
}

export function Header({ userEmail, onLogout }: Props) {
  return (
    <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between p-4">
        <span className="text-lg font-semibold">English Assist</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {userEmail}
          </span>
          <ModeToggle />
          <form action={onLogout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
