import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CJS OS',
  description: 'Système de gestion interne - Cath Jewelry Store',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}