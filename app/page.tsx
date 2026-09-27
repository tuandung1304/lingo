import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'

import { logout } from './login/actions'

export default async function Home() {
  const user = await requireUser()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">English Assist</h1>
        <form action={logout} className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{user.email}</span>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <p className="text-muted-foreground text-sm">
        Phase 0 done. Check Bedrock at{' '}
        <Link href="/api/ai-check" prefetch={false} className="underline">
          /api/ai-check
        </Link>
        .
      </p>
    </main>
  )
}
