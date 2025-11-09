import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { headers } from 'next/headers'
import './globals.css'
import ContextProvider from '@/context'
import { PayNovaContractProvider } from '@/context/PayNovaProvider'
import NavbarBalances from '@/components/NavbarBalances'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pay-Nova',
  description: 'Simple Payment App',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersObj = await headers()
  const cookies = headersObj.get('cookie')

  return (
    <html lang="en">
      <body className={inter.className}>
        <ContextProvider cookies={cookies}>
          <PayNovaContractProvider>
            {/* ---------- FIXED NAVBAR ---------- */}
            <nav className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-3 bg-white/10 backdrop-blur-md border-b border-white/20">
              <Link href="/" className="text-2xl font-bold text-white tracking-wide">
                PayNova
              </Link>
             <NavbarBalances />
              <appkit-button />
            </nav>

            {/* ---------- PAGE CONTENT (starts below navbar) ---------- */}
            <main>{children}</main>
          </PayNovaContractProvider>
        </ContextProvider>
      </body>
    </html>
  )
}