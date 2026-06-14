import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

import { Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: '#6366f1',
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
    icon: '/icon.png?v=3',
    apple: '/icon.png?v=3',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={inter.className}>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
