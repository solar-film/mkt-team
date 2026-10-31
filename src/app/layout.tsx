import type { Metadata } from 'next'
import { Prompt } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { AuthProvider } from '@/contexts/AuthContext'

// Self-hosted at build time by next/font, so pages make no request to Google.
const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-prompt',
})

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: '#034aad',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'MKT-GFS - ระบบติดตามทีมการตลาดและคอนเท้น',
  description: 'ระบบติดตามงาน ผลงาน KPI และคอนเท้นของพนักงานในทีมการตลาด',
  appleWebApp: {
    capable: true,
    title: 'MKT-GFS',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon.png?v=4',
    apple: '/icon.png?v=4',
  },
}

import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>
        <AuthProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  )
}
