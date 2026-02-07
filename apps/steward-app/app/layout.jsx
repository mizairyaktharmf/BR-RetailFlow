import './globals.css'
import { Toaster } from '@/components/ui/toaster'

export const metadata = {
  title: 'BR-RetailFlow | Flavor Expert App',
  description: 'Baskin Robbins Ice Cream Inventory & Sales Management System for Flavor Experts',
  manifest: '/manifest.json',
  themeColor: '#FF69B4',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-gray-50">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
