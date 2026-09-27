'use server'

import { redirect } from 'next/navigation'

import { isAllowedEmail } from '@/lib/allowlist'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error?: string } | undefined

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!isAllowedEmail(email)) return { error: 'This email is not allowed.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
