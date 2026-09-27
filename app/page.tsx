import Link from 'next/link'

import { Header } from '@/components/header'
import { requireUser } from '@/lib/auth'

import { logout } from './login/actions'

export default async function Home() {
  const user = await requireUser()

  return (
    <>
      <Header userEmail={user.email} onLogout={logout} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <p className="text-muted-foreground text-sm">
          Phase 0 done. Check Bedrock at{' '}
          <Link href="/api/ai-check" prefetch={false} className="underline">
            /api/ai-check
          </Link>
          .
        </p>
      </main>
    </>
  )
}
