import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Zero Trace - Survival Test',
  description: '제한 시간 60초. 움직임을 유지하면서 밀려오는 탄막을 피하세요.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function DodgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
