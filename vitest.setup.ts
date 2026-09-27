import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Only relevant for jsdom-environment (component) tests; `@vitest-environment
// node` files don't have these globals at all.
afterEach(() => {
  cleanup()
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  // jsdom doesn't implement the Clipboard API
  Object.assign(navigator, {
    clipboard: { writeText: async () => {} },
  })
}
