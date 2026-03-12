import type { Metadata } from 'next'
import Script from 'next/script'
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
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-4WBHPXNRST" strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-4WBHPXNRST');
        `}
      </Script>
      <body className={`${sourceSerif.variable} ${dmSans.variable} font-[family-name:var(--font-sans)] bg-cream text-ink min-h-screen antialiased`}>
        <main className="max-w-3xl mx-auto px-6 py-12">
          {children}
        </main>
        <footer className="max-w-3xl mx-auto px-6 pb-8 text-center text-xs text-ink-faint">
          &copy; {new Date().getFullYear()}{' '}
          <a href="https://smartlayer.ventures" target="_blank" rel="noopener noreferrer" className="hover:text-amber transition-colors">
            SmartLayer Ventures
          </a>
        </footer>
      </body>
    </html>
  )
}
