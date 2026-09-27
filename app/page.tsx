import { Header } from '@/components/header'
import { getHistoryItem } from '@/lib/assist/history'
import { requireUser } from '@/lib/auth'

import { Assist } from './assist'

export default async function Home({ searchParams }: PageProps<'/'>) {
  const user = await requireUser()
  const { session: id } = await searchParams
  const session =
    typeof id === 'string' ? await getHistoryItem(user.id, id) : null

  return (
    <>
      <Header userEmail={user.email} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        <Assist key={session?.id ?? 'new'} session={session} />
      </main>
    </>
  )
}
