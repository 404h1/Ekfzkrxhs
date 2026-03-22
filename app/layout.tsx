import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '60초 챌린지',
  description: '60초를 채우면 상품이 있습니다*',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
