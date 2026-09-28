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
    <main className="from-muted/40 to-background relative flex flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-b p-4">
      <Logo className="size-12 text-lg shadow-md" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">Lingo</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
