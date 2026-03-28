import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Zero Trace - Survival Test',
  description: '제한 시간 60초. 움직임을 유지하면서 밀려오는 탄막을 피하세요.',
}

export default function DodgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
