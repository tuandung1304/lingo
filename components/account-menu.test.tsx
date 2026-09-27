import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock factories are hoisted above imports, so any variable they close
// over must be created with vi.hoisted() to avoid a temporal-dead-zone error.
const { setTheme, logout } = vi.hoisted(() => ({
  setTheme: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme }),
}))
vi.mock('@/app/login/actions', () => ({ logout }))

import { AccountMenu } from './account-menu'

async function openMenu() {
  const user = userEvent.setup()
  render(<AccountMenu email="me@example.com" />)
  await user.click(screen.getByRole('button', { name: 'Account' }))
  // The popup mounts asynchronously
  await screen.findByRole('menu')
  return user
}

beforeEach(() => {
  setTheme.mockClear()
  logout.mockClear()
})

describe('AccountMenu', () => {
  it('shows the email initial and the full email when opened', async () => {
    await openMenu()

    expect(screen.getByRole('button', { name: 'Account' })).toHaveTextContent(
      'm',
    )
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
  })

  it('switches the theme', async () => {
    const user = await openMenu()

    await user.click(screen.getByRole('menuitemradio', { name: /dark/i }))

    expect(setTheme).toHaveBeenCalledWith('dark', expect.anything())
  })

  it('signs out', async () => {
    const user = await openMenu()

    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))

    expect(logout).toHaveBeenCalled()
  })
})
