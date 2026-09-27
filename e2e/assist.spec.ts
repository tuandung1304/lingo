import { expect, test } from '@playwright/test'

// Exercises the signed-in Fix and Suggest flows. Requires a real allowlisted Supabase
// account, so it's opt-in via env vars and skipped otherwise (e.g. in CI
// without secrets configured). `/api/assist` is always mocked here so this
// suite never calls the real Bedrock model - see TESTING.md.
const email = process.env.E2E_TEST_EMAIL
const password = process.env.E2E_TEST_PASSWORD

const SUGGEST_BODY = {
  suggestions: [
    'The server was lagging like crazy yesterday.',
    'Yesterday the server lag was brutal.',
  ],
  vocab: [{ phrase: 'like crazy', meaning: 'Rất nhiều, dữ dội.' }],
}

test.describe('assist (signed in)', () => {
  test.skip(
    !email || !password,
    'set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (a real allowlisted account) to run this',
  )

  test.beforeEach(async ({ page }) => {
    // `useObject` just reads the response body as accumulating JSON text -
    // no need to replicate the Bedrock/AI-SDK stream framing.
    await page.route('/api/assist', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        headers: { 'x-assist-session': 'e2e-session' },
        body: JSON.stringify(
          route.request().postDataJSON().mode === 'suggest'
            ? SUGGEST_BODY
            : {
                corrected: 'He went to school yesterday.',
                alternatives: ['I was at school yesterday.'],
                edits: [
                  {
                    original: 'goes',
                    replacement: 'went',
                    type: 'grammar',
                    explanation: 'Past tense is needed for "yesterday".',
                  },
                ],
              },
        ),
      }),
    )

    // Every test starts in Fix, whatever mode a previous run left behind
    await page.addInitScript(() => localStorage.removeItem('assist.mode'))

    await page.goto('/login')
    await page.getByLabel('Email').fill(email!)
    await page.getByLabel('Password').fill(password!)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
  })

  test('fixes a sentence and shows the alternative + explanation', async ({
    page,
  }) => {
    await page.getByLabel('Sentence to fix').fill('he goes school yesterday')
    await page.keyboard.press('Control+Enter')

    await expect(page.getByText('I was at school yesterday.')).toBeVisible()
    await expect(
      page.getByText('Past tense is needed for "yesterday".'),
    ).toBeVisible()
  })

  test('copies the corrected sentence with the "1" shortcut', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.getByLabel('Sentence to fix').fill('he goes school yesterday')
    await page.keyboard.press('Control+Enter')
    await expect(page.getByText('I was at school yesterday.')).toBeVisible()

    await page.keyboard.press('1')

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    )
    expect(clipboardText).toBe('He went to school yesterday.')
  })

  test('suggests sentences and explains a phrase', async ({ page }) => {
    await page.getByRole('tab', { name: 'Suggest' }).click()
    await page.getByLabel('What you want to say').fill('hôm qua server lag')
    await page.keyboard.press('Control+Enter')

    await expect(
      page.getByText('Yesterday the server lag was brutal.'),
    ).toBeVisible()
    await expect(page.getByText('Rất nhiều, dữ dội.')).toBeVisible()
  })

  test('links the finished answer in the URL', async ({ page }) => {
    await page.getByLabel('Sentence to fix').fill('he goes school yesterday')
    await page.keyboard.press('Control+Enter')

    await expect(page.getByText('I was at school yesterday.')).toBeVisible()
    await expect(page).toHaveURL('/?session=e2e-session')
  })
})
