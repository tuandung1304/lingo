# Testing

Two layers, two jobs:

- **Vitest** (`*.test.ts(x)`, colocated next to the file they test) — fast, in-process tests for pure logic and component behavior. Runs in jsdom.
- **Playwright** (`e2e/*.spec.ts`) — real-browser tests against `yarn dev`, for things only a real browser+server can prove (auth redirects, real navigation).

```bash
yarn test              # vitest, once
yarn test:watch        # vitest, watch mode
yarn test:coverage     # vitest with coverage (text + html report)
yarn test:e2e          # playwright, headless
yarn test:e2e:ui       # playwright's UI mode (great for debugging)
```

## Where things live

Tests are colocated (`app/assist.tsx` → `app/assist.test.tsx`), not in a parallel `__tests__/` tree. It keeps a file and its test one `ls` apart, and a deleted source file can't leave an orphaned test behind unnoticed.

## What to unit test vs. what to E2E

Vitest can't run `async` Server Components (Next's own limitation — see `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`). That pushes the split naturally:

- **Vitest**: pure functions (`lib/**`), sync client components, hooks-driven interaction (keyboard shortcuts, form state), anything you can fully control by mocking its inputs.
- **Playwright**: `async` Server Components/pages (`app/page.tsx`), the auth guard in `proxy.ts`, and anything that only breaks when the real request pipeline runs.

Don't duplicate coverage across layers: `buildSegments` is unit-tested exhaustively in `lib/assist/highlight.test.ts`, so the Playwright specs don't re-check diff edge cases — they only check that a submit round-trip renders _something_ correct end to end.

## Core conventions

- **Test behavior, not implementation.** Assert on what the user sees/gets (rendered text, a function's return value, a network call's payload), never on internal state or which hooks fired.
- **Arrange / Act / Assert**, in that order, one behavior per `it`. If a test needs a comment to explain what section is which, split it.
- **Mock at the boundary, not in the middle.** Mock `@ai-sdk/react`'s `useObject` (network) or `next/navigation`'s `redirect` (framework), never `buildSegments` or other code you own — if you're mocking your own logic, the test is testing the mock instead of the code.
- **Prefer Testing Library queries by role/label** (`getByRole`, `getByLabelText`) over `getByTestId`. If a query is awkward, that's often a sign the markup is missing an accessible name — fix the markup, don't reach for a test id.
- **`userEvent` over `fireEvent`** — it simulates the full sequence of real browser events (focus, keydown, keyup, etc.), which is what actually breaks keyboard-shortcut code.
- **No snapshot tests.** They pass on any change (including bugs) and get updated on autopilot; a targeted assertion catches the actual thing that matters and reads as documentation.
- **`// @vitest-environment node`** on any test file with no DOM in it (see `lib/allowlist.test.ts`, `lib/assist/schema.test.ts`) — jsdom setup is the majority of a test file's runtime cost, and pure-logic tests don't need it.
- **`server-only` modules are unit-testable.** The `server-only` package throws unless Next's own build sets a special export condition; `vitest.config.mts` aliases it to a no-op (`test/mocks/server-only.ts`) so files like `lib/auth.ts` can be imported directly in tests. Don't remove that alias to "fix" an unrelated failure — the throw is expected outside Next's build.
- **`vi.mock(...)` factories are hoisted above imports.** Any variable a factory closes over must come from `vi.hoisted(() => ...)`, or you'll get a temporal-dead-zone error. See `components/account-menu.test.tsx` for the pattern.
- **React's `cache()`** (used by `getCurrentUser` in `lib/auth.ts`) memoizes per module instance. Tests that need different mock results per case call `vi.resetModules()` and re-`import()` the module fresh — see `lib/auth.test.ts`.

## Playwright specifics for this app

- **Never hit the real Bedrock model or a real Supabase account from a test.** Bedrock calls cost money against a $5/month budget, and streaming responses make assertions flaky. `/api/assist` should always be intercepted with `page.route(...)` and fulfilled with a canned response — see `e2e/assist.spec.ts`. The client (`useObject`) just reads the response body as accumulating JSON text, so the mock body can be a plain `JSON.stringify(fakeResult)` with `contentType: 'text/plain'` — no need to replicate the AI SDK's streaming wire format.
- **Tests needing a real signed-in session are opt-in.** `e2e/assist.spec.ts` skips itself unless `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` are set (a real allowlisted Supabase account — put them in `.env.local`, never commit them). `e2e/auth.spec.ts` needs no credentials: it only exercises the allowlist rejection (which short-circuits before any Supabase call) and the unauthenticated redirect.
- Watch for **duplicate `role="alert"`**: Next.js's route announcer (`#__next-route-announcer__`) also has `role="alert"`, so `getByRole('alert')` can match two elements on a page that navigated. Scope by text (`getByText(...)`) instead.
- Config runs **Chromium only** (`playwright.config.ts`) to keep local/CI runs fast. Add `devices['Desktop Firefox']`/`webkit` to the `projects` array if you need real cross-browser coverage later.

## Coverage philosophy

`yarn test:coverage` excludes `components/ui/**` (generated shadcn/base-ui primitives — not our logic to verify) and test files themselves. Aim to cover:

- Business logic with actual edge cases: allowlist parsing, the highlight/diff matcher, zod schemas.
- Interaction logic a regression would silently break: keyboard shortcuts, tone persistence, copy-to-clipboard.

Don't chase 100%. An `AccountMenu` theme switch with one happy-path test is enough; testing that `useTheme` itself works is `next-themes`'s job, not ours.
