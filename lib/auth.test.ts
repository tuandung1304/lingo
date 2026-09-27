// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClaims, redirect } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getClaims } }),
}))

async function importAuth() {
  vi.resetModules()
  return import('./auth')
}

describe('getCurrentUser', () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = 'allowed@example.com'
    getClaims.mockReset()
  })

  it('returns null when there is no session', async () => {
    getClaims.mockResolvedValue({ data: { claims: null } })
    const { getCurrentUser } = await importAuth()
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns null when the session email is not on the allowlist', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'stranger@example.com' } },
    })
    const { getCurrentUser } = await importAuth()
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns the user when signed in and allowlisted', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'allowed@example.com' } },
    })
    const { getCurrentUser } = await importAuth()
    expect(await getCurrentUser()).toEqual({
      id: 'user-1',
      email: 'allowed@example.com',
    })
  })
})

describe('requireUser', () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = 'allowed@example.com'
    getClaims.mockReset()
    redirect.mockClear()
  })

  it('redirects to /login when there is no user', async () => {
    getClaims.mockResolvedValue({ data: { claims: null } })
    const { requireUser } = await importAuth()

    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('returns the user without redirecting when signed in', async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'allowed@example.com' } },
    })
    const { requireUser } = await importAuth()

    await expect(requireUser()).resolves.toEqual({
      id: 'user-1',
      email: 'allowed@example.com',
    })
    expect(redirect).not.toHaveBeenCalled()
  })
})
