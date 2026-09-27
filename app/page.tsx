import { Header } from '@/components/header'
import { requireUser } from '@/lib/auth'

import { Assist } from './assist'

export default async function Home() {
  const user = await requireUser()

  return (
    <>
      <Header userEmail={user.email} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        <Assist />
      </main>
    </>
  )
}
