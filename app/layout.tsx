import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { fontVariables } from './fonts'
import './tokens.css'
import './globals.css'

export const metadata: Metadata = {
  title: '∅FREQ',
  description: 'A voice becomes a frequency. The voice stays with you; the abstraction enters the record.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <div className="plate-exposure" aria-hidden="true" />
        <div className="shell">{children}</div>
      </body>
    </html>
  )
}
