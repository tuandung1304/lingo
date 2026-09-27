import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    // `server-only` throws unless the "react-server" export condition is set
    // (only true in Next.js's own build). Point it at a no-op so modules that
    // import it (lib/auth.ts, lib/ai/*) can still be unit tested.
    alias: {
      'server-only': new URL('./test/mocks/server-only.ts', import.meta.url)
        .pathname,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/**', 'components/**', 'lib/**'],
      exclude: ['**/*.test.*', 'components/ui/**'],
    },
  },
})
