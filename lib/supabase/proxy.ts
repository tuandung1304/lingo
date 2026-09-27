import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import { isAllowedEmail } from '@/lib/allowlist'

const PUBLIC_PATHS = ['/login']

// Refreshes the Supabase session cookie and does an optimistic auth redirect.
// Real authorization still happens in pages/routes via lib/auth.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          )
        },
      },
    },
  )

  // Don't run code between createServerClient and getClaims: it can cause
  // random logouts. getClaims() verifies the JWT and refreshes it if expired.
  const { data } = await supabase.auth.getClaims()
  const email = data?.claims?.email as string | undefined
  const signedIn = !!data?.claims && isAllowedEmail(email)

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!signedIn && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return redirectKeepingCookies(request, response, '/login')
  }

  if (signedIn && pathname === '/login') {
    return redirectKeepingCookies(request, response, '/')
  }

  return response
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  to: string,
) {
  const redirect = NextResponse.redirect(new URL(to, request.url))
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}
