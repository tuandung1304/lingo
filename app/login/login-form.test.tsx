import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { login } = vi.hoisted(() => ({ login: vi.fn() }))
vi.mock('./actions', () => ({ login }))

import { LoginForm } from './login-form'

describe('LoginForm', () => {
  it('renders email, password and a submit button', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows the server error returned by the login action', async () => {
    login.mockResolvedValue({ error: 'This email is not allowed.' })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'nobody@example.com')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This email is not allowed.',
    )
  })

  it('disables the button and shows a pending label while the action runs', async () => {
    let resolveLogin!: (state: { error?: string }) => void
    login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'a@example.com')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const button = await screen.findByRole('button', { name: 'Signing in…' })
    expect(button).toBeDisabled()

    resolveLogin({})
    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).not.toBeDisabled()
  })
})
