import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Everything except static assets, images, and the generated favicon/icon routes
    '/((?!_next/static|_next/image|favicon.ico|icon$|apple-icon$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
