import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { isAllowedEmail } from '@/lib/allowlist'
import { createClient } from '@/lib/supabase/server'

export type CurrentUser = { id: string; email: string }

// Verified user for this request, or null. Deduped per request via cache().
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const email = claims?.email as string | undefined
  if (!claims?.sub || !email || !isAllowedEmail(email)) return null
  return { id: claims.sub, email }
})

// For pages and server actions
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
