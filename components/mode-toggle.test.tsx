import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// vi.mock factories are hoisted above imports, so any variable they close
// over must be created with vi.hoisted() to avoid a temporal-dead-zone error.
const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }))

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme }),
}))

import { ModeToggle } from './mode-toggle'

describe('ModeToggle', () => {
  it('switches from light to dark on click', async () => {
    const user = userEvent.setup()
    render(<ModeToggle />)

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }))

    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})
