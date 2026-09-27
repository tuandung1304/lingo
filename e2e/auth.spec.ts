import { expect, test } from '@playwright/test'

// These run with no login and no mocking: they only exercise the proxy's
// auth-guard redirect and the allowlist check, both of which are safe to hit
// for real (no Bedrock/Supabase account access is triggered).

test('redirects an unauthenticated visitor from / to /login', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Sign in to continue')).toBeVisible()
})

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('rejects a non-allowlisted email without needing a real account', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('not-allowed-e2e-test@example.com')
  await page.getByLabel('Password').fill('irrelevant-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // The allowlist check runs before any Supabase call, so this is
  // deterministic regardless of the real ALLOWED_EMAILS value.
  // (Next.js's own route announcer also has role="alert", so scope by text.)
  await expect(page.getByText('This email is not allowed.')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})
