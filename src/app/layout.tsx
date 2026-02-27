import type { Metadata } from 'next'
import { Source_Serif_4, DM_Sans } from 'next/font/google'
import './globals.css'

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Conversation With AI',
  description: 'Moderate a roundtable discussion between frontier AI models',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sourceSerif.variable} ${dmSans.variable} font-[family-name:var(--font-sans)] bg-cream text-ink min-h-screen antialiased`}>
        <main className="max-w-3xl mx-auto px-6 py-12">
          {children}
        </main>
      </body>
    </html>
  )
}
