import { Logo } from '@/components/logo'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <Logo className="size-12 rounded-xl" />
      <Card className="o-ly w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Lingo</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
