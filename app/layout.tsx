import type { Metadata, Viewport } from 'next'
import { Be_Vietnam_Pro, Caveat } from 'next/font/google'

import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'

import './globals.css'

// Drawn by Vietnamese designers, so the diacritics in Suggest input and vocab meanings sit right
const beVietnam = Be_Vietnam_Pro({
  variable: '--font-be-vietnam',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
})

// Only for the red-pen corrections written above the line
const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Lingo',
  description: 'Personal English speaking assistant',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
    { media: '(prefers-color-scheme: dark)', color: '#16201c' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${beVietnam.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
