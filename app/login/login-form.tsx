'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { login } from './actions'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="bg-card dark:bg-card h-9"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="bg-card dark:bg-card h-9"
          required
        />
      </div>
      {state?.error && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-9 font-semibold">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
