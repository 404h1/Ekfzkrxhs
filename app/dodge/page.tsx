'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import s from './dodge.module.css'

// ─── Types ───────────────────────────────────────────────

type Route = 'normal' | 'instant' | 'hope' | 'pattern' | 'growth' | 'reward' | 'hudDrop' | 'drift' | 'darkness' | 'wall' | 'bigBullet' | 'error59'
type PauseReason = 'none' | 'collection' | 'brightness'
type Phase = 'idle' | 'playing' | 'result' | 'error' | 'brightness' | 'collection'

interface Bullet {
  x: number; y: number; vx: number; vy: number; r: number; color: string
  kind?: 'hudDrop' | 'behemoth'
  w?: number; h?: number; text?: string; border?: string; textColor?: string
  growth?: number; maxR?: number
}

interface EndingData {
  id: string; name: string; description: string; unlockHint: string
}

interface GameState {
  running: boolean; attempts: number
  mouseX: number; mouseY: number; playerX: number; playerY: number; playerRadius: number
  time: number; displayedTime: number; level: number
  bullets: Bullet[]; particles: never[]
  currentRoute: Route; lastTimestamp: number
  darknessAlpha: number; paused: boolean; pauseReason: PauseReason
  darknessAdjusted: boolean; darknessPauseTriggered: boolean
  instantTriggered: boolean; hopeTrapPhase: number; patternWaveIndex: number
  hudDropWave: number; hudDropWarningShown: boolean
  growthWarningShown: boolean; driftWarningShown: boolean
  wallPhase: number; wallGapIndex: number
  rewardWarningShown: boolean; rewardTrapPhase: number
  bigBulletSpawned: boolean; bigBulletWarningShown: boolean; bigBulletTrapPhase: number
  errorPulseCount: number; errorTriggered: boolean
  collected: string[]
}

// ─── Constants ───────────────────────────────────────────

const STORAGE_KEY = 'april_fools_dodge_collection_v1'
const WIDTH = 1280
const HEIGHT = 720
const SURVIVAL_TARGET = 60
const ROUTES: Route[] = ['normal', 'instant', 'hope', 'pattern', 'growth', 'reward', 'hudDrop', 'drift', 'darkness', 'wall', 'bigBullet', 'error59']

const ENDINGS: Record<string, EndingData> = {
  normalFail: { id: 'END 00', name: '정상 플레이', description: '총알은 늘고 속도는 빨라졌습니다. 이 게임이 가장 정상적인 얼굴을 하고 있던 기록입니다.', unlockHint: '미확인' },
  instant: { id: 'END 01', name: '시작하자마자 사망', description: '당신은 게임을 시작했습니다. 그리고 끝났습니다.', unlockHint: '미확인' },
  hope: { id: 'END 02', name: '어? 할만한데?', description: '당신은 희망을 느꼈습니다. 그게 문제였습니다.', unlockHint: '미확인' },
  pattern: { id: 'END 03', name: '이제 이해했다', description: '이해한 순간, 게임은 당신을 이해했습니다.', unlockHint: '미확인' },
  growth: { id: 'END 04', name: '크기 증가', description: '몸집은 조금씩 커졌고, 마지막엔 회피라는 말이 예의가 아니게 됐습니다.', unlockHint: '미확인' },
  error59: { id: 'END 05', name: '시간의 함정', description: '시간은 흐르지 않습니다. 당신만 늙습니다.', unlockHint: '미확인' },
  reward: { id: 'END 06', name: '시스템 오류', description: '버그가 아니라 기능입니다.', unlockHint: '미확인' },
  hudDrop: { id: 'END 11', name: '인터페이스 낙하', description: '시간, 레벨, 상태 표시는 안내가 아니라 낙하물이었다.', unlockHint: '미확인' },
  drift: { id: 'END 07', name: '입력 이탈', description: '포인터는 멀쩡했지만, 기체가 당신의 의도를 끝까지 따라오진 않았습니다.', unlockHint: '미확인' },
  darkness: { id: 'END 08', name: '시야 암전', description: '밝기를 올렸습니다. 어둠도 같이 올라왔습니다.', unlockHint: '미확인' },
  wall: { id: 'END 09', name: '여긴 안전합니다 (아님)', description: '안전지대는 있었습니다. 당신이 들어간 직후 없어졌을 뿐입니다.', unlockHint: '미확인' },
  bigBullet: { id: 'END 10', name: '대형 탄환', description: '처음엔 피할 수 있어 보였습니다. 그 한 발이 남은 공간까지 먹어치우기 전까지는요.', unlockHint: '미확인' },
  fakeFinal: { id: 'END 99', name: '완전 생존', description: '모든 기록을 확보한 뒤 무피격으로 60초를 완주하면 해금된다고 알려진 최종 생존 기록입니다.', unlockHint: '모든 기록 수집 후 무피격 60초 생존' },
}

const COLLECTION_ORDER = ['normalFail', 'instant', 'hope', 'pattern', 'growth', 'error59', 'reward', 'hudDrop', 'drift', 'darkness', 'wall', 'bigBullet', 'fakeFinal']
const TOTAL_VISIBLE_COLLECTION = 12

// ─── Helpers ─────────────────────────────────────────────

function loadCollection(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCollection(collected: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collected))
}

function publicRouteLabel(route: Route): string {
  const labels: Record<Route, string> = {
    normal: '기본 패턴', instant: '즉발 패턴', hope: '희망 패턴', pattern: '학습 패턴',
    growth: '성장 패턴', reward: '오류 창 패턴', hudDrop: 'UI 낙하 패턴', bigBullet: '대형 탄환 패턴',
    drift: '입력 오차 패턴', darkness: '암전 패턴', wall: '안전지대 패턴', error59: '시간 단축 패턴',
  }
  return labels[route] || '대기'
}

function getSessionTarget(route: Route): number {
  return route === 'error59' ? 30 : SURVIVAL_TARGET
}

function getEndingTitle(key: string): string {
  const data = ENDINGS[key]
  return data ? data.id + ': ' + data.name : key
}

function getCollectedCount(collected: string[]): number {
  return collected.filter((k) => k !== 'fakeFinal').length
}

function createInitialGameState(): GameState {
  return {
    running: false, attempts: 0,
    mouseX: WIDTH / 2, mouseY: HEIGHT / 2, playerX: WIDTH / 2, playerY: HEIGHT / 2, playerRadius: 10,
    time: 0, displayedTime: 0, level: 1,
    bullets: [], particles: [],
    currentRoute: 'normal', lastTimestamp: 0,
    darknessAlpha: 0, paused: false, pauseReason: 'none',
    darknessAdjusted: false, darknessPauseTriggered: false,
    instantTriggered: false, hopeTrapPhase: 0, patternWaveIndex: -1,
    hudDropWave: -1, hudDropWarningShown: false,
    growthWarningShown: false, driftWarningShown: false,
    wallPhase: 0, wallGapIndex: 0,
    rewardWarningShown: false, rewardTrapPhase: 0,
    bigBulletSpawned: false, bigBulletWarningShown: false, bigBulletTrapPhase: 0,
    errorPulseCount: -1, errorTriggered: false,
    collected: [],
  }
}

// ─── Main Component ──────────────────────────────────────

export default function DodgePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const gs = useRef<GameState>(createInitialGameState())

  const [phase, setPhase] = useState<Phase>('idle')
  const [collected, setCollected] = useState<string[]>([])
  const [uiMessage, setUiMessage] = useState('포인터를 이동해 기체를 제어하세요. 시작 후 난도가 점진적으로 상승합니다.')
  const [uiTime, setUiTime] = useState('0.00')
  const [uiLevel, setUiLevel] = useState(1)
  const [uiProgress, setUiProgress] = useState(0)
  const [uiAttempts, setUiAttempts] = useState(0)
  const [uiRoute, setUiRoute] = useState<Route>('normal')
  const [uiHudHint, setUiHudHint] = useState('마우스로 이동')
  const [uiHudOpacity, setUiHudOpacity] = useState(1)
  const [resultInfo, setResultInfo] = useState<{ title: string; description: string; footer: string } | null>(null)

  useEffect(() => {
    const c = loadCollection()
    gs.current.collected = c
    setCollected(c)
  }, [])

  // ─── Canvas rendering helpers ──────────────────────────

  const traceRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) => {
    const r = Math.min(radius, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
    gradient.addColorStop(0, '#0f172a')
    gradient.addColorStop(1, '#020617')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.save()
    ctx.globalAlpha = 0.08
    for (let x = 0; x < WIDTH; x += 40) { ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x, 0, 1, HEIGHT) }
    for (let y = 0; y < HEIGHT; y += 40) { ctx.fillRect(0, y, WIDTH, 1) }
    ctx.restore()
  }

  const drawBullets = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    for (const bullet of g.bullets) {
      if (bullet.kind === 'hudDrop') {
        const x = bullet.x - (bullet.w || 0) / 2
        const y = bullet.y - (bullet.h || 0) / 2
        ctx.save()
        ctx.fillStyle = bullet.color
        traceRoundedRect(ctx, x, y, bullet.w || 0, bullet.h || 0, (bullet.h || 0) / 2)
        ctx.fill()
        ctx.strokeStyle = bullet.border || '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = bullet.textColor || '#fff'
        ctx.font = '800 22px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(bullet.text || '', bullet.x, bullet.y + 1, (bullet.w || 0) - 24)
        ctx.restore()
        continue
      }
      ctx.beginPath()
      ctx.fillStyle = bullet.color
      ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2)
      ctx.fill()
      if (bullet.growth) {
        ctx.save()
        ctx.strokeStyle = 'rgba(254, 202, 202, 0.45)'
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, bullet.r + 18, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    ctx.beginPath()
    ctx.fillStyle = '#f8fafc'
    ctx.arc(g.playerX, g.playerY, g.playerRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(96,165,250,0.9)'
    ctx.lineWidth = 3
    ctx.arc(g.playerX, g.playerY, g.playerRadius + 7, 0, Math.PI * 2)
    ctx.stroke()
  }

  const drawDarkness = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    if (g.currentRoute !== 'darkness') return
    ctx.save()
    ctx.fillStyle = `rgba(0,0,0,${g.darknessAlpha})`
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.restore()
  }

  const getPlayerTarget = () => {
    const g = gs.current
    let targetX = g.mouseX
    let targetY = g.mouseY
    if (g.currentRoute === 'drift' && g.time > 9) {
      const strength = Math.min(1, (g.time - 9) / 10)
      targetX += Math.sin(g.time * 1.55) * (40 + 170 * strength)
      targetY += Math.cos(g.time * 1.18) * (24 + 120 * strength)
      if (g.time > 17) {
        targetX += (WIDTH / 2 - g.mouseX) * 0.16 * strength
        targetY += (HEIGHT / 2 - g.mouseY) * 0.12 * strength
      }
    }
    return { x: targetX, y: targetY }
  }

  const drawDriftGuide = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    if (g.currentRoute !== 'drift' || g.time < 10) return
    const target = getPlayerTarget()
    ctx.save()
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.36)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(target.x, target.y, 18 + Math.sin(g.time * 5) * 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(target.x - 16, target.y)
    ctx.lineTo(target.x + 16, target.y)
    ctx.moveTo(target.x, target.y - 16)
    ctx.lineTo(target.x, target.y + 16)
    ctx.stroke()
    ctx.restore()
  }

  const drawRewardBanner = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    if (g.currentRoute !== 'reward' || g.time < 13.4 || g.time > 18.1) return
    const width = 760
    const height = 240
    const x = (WIDTH - width) / 2
    const y = HEIGHT * 0.24
    const pulse = 0.92 + Math.sin(g.time * 7) * 0.03
    ctx.save()
    ctx.globalAlpha = 0.98
    ctx.fillStyle = 'rgba(248,250,252,0.98)'
    ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = 'rgba(250,204,21,0.95)'
    ctx.lineWidth = 6
    ctx.strokeRect(x, y, width, height)
    ctx.globalAlpha = pulse
    ctx.fillStyle = 'rgba(15,23,42,0.9)'
    ctx.font = '900 52px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('SYSTEM ERROR', WIDTH / 2, y + 82)
    ctx.fillStyle = 'rgba(15,23,42,0.66)'
    ctx.font = '700 24px Arial'
    ctx.fillText('치명적이지 않은 오류를 처리하는 중입니다', WIDTH / 2, y + 132)
    ctx.fillStyle = 'rgba(251,191,36,0.28)'
    ctx.fillRect(WIDTH / 2 - 180, y + 160, 360, 42)
    ctx.fillStyle = 'rgba(15,23,42,0.75)'
    ctx.font = '800 20px Arial'
    ctx.fillText('복구 중...', WIDTH / 2, y + 188)
    ctx.restore()
  }

  const drawTextGuide = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    ctx.save()
    ctx.fillStyle = 'rgba(148,163,184,0.16)'
    ctx.font = 'bold 74px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(publicRouteLabel(g.currentRoute), WIDTH / 2, HEIGHT / 2 + 26)
    ctx.restore()
  }

  const renderScene = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawBackground(ctx)
    drawTextGuide(ctx)
    drawBullets(ctx)
    drawDriftGuide(ctx)
    drawPlayer(ctx)
    drawDarkness(ctx)
    drawRewardBanner(ctx)
  }, [])

  // ─── Game logic ────────────────────────────────────────

  const spawnBullet = (x: number, y: number, vx: number, vy: number, r: number, color?: string) => {
    gs.current.bullets.push({ x, y, vx, vy, r, color: color || 'rgba(255,255,255,0.95)' })
  }

  const spawnRing = (count: number, speed: number, radius: number, offset?: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (offset || 0)
      spawnBullet(WIDTH / 2, HEIGHT / 2, Math.cos(angle) * speed, Math.sin(angle) * speed, radius, 'rgba(125,211,252,0.95)')
    }
  }

  const spawnHudDropBullet = (text: string, slotIndex: number, waveIndex: number) => {
    const slots = [
      { x: 110, vx: 36 }, { x: 248, vx: -28 }, { x: 404, vx: 24 }, { x: WIDTH - 188, vx: -34 }
    ]
    const slot = slots[slotIndex % slots.length]
    const width = Math.min(340, Math.max(150, 56 + text.length * 16))
    const height = 48
    gs.current.bullets.push({
      kind: 'hudDrop', x: slot.x, y: 46,
      vx: slot.vx + Math.sin(waveIndex * 1.2) * 18, vy: 248 + waveIndex * 12,
      w: width, h: height, r: Math.max(width, height) * 0.55,
      text, color: 'rgba(15,23,42,0.96)', border: 'rgba(226,232,240,0.82)', textColor: '#f8fafc'
    })
  }

  const spawnNormalPattern = (delta: number) => {
    const g = gs.current
    const density = 0.8 + g.level * 0.65
    const speedBase = 120 + g.time * 7 + g.level * 16
    if (Math.random() < density * delta) {
      const side = Math.floor(Math.random() * 4)
      let x = 0, y = 0
      if (side === 0) { x = -20; y = Math.random() * HEIGHT }
      if (side === 1) { x = WIDTH + 20; y = Math.random() * HEIGHT }
      if (side === 2) { x = Math.random() * WIDTH; y = -20 }
      if (side === 3) { x = Math.random() * WIDTH; y = HEIGHT + 20 }
      const angle = Math.atan2(g.playerY - y, g.playerX - x) + (Math.random() - 0.5) * 0.6
      const speed = speedBase + Math.random() * 90
      spawnBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 8 + Math.random() * 8, 'rgba(248,250,252,0.92)')
    }
    if (g.time > 18 && Math.random() < 0.55 * delta) {
      spawnRing(8 + g.level * 2, 120 + g.level * 20, 8, g.time * 0.6)
    }
    if (g.time > 38 && Math.random() < 0.38 * delta) {
      const y = Math.random() * HEIGHT
      for (let i = 0; i < 7; i++) { spawnBullet(-40 - i * 30, y + i * 18, 280 + g.time * 4, 0, 10, 'rgba(251,191,36,0.95)') }
    }
  }

  const updateLevel = () => {
    const g = gs.current
    if (g.time < 8) g.level = 1
    else if (g.time < 18) g.level = 2
    else if (g.time < 30) g.level = 3
    else if (g.time < 44) g.level = 4
    else if (g.time < 54) g.level = 5
    else g.level = 6
  }

  const updateDisplayedTime = (delta: number) => {
    const g = gs.current
    const target = getSessionTarget(g.currentRoute)
    if (g.currentRoute !== 'error59') {
      g.displayedTime = Math.min(target, g.time)
      return
    }
    if (g.time < 20) {
      g.displayedTime = g.time
    } else {
      if (g.displayedTime < 20) g.displayedTime = 20
      const slowProgress = Math.min(1, (g.time - 20) / 12)
      const rate = 1 - 0.6 * Math.pow(slowProgress, 1.6)
      g.displayedTime += delta * rate
    }
    if ((g.displayedTime > 29.02 || g.time > 36) && !g.errorTriggered) {
      g.errorTriggered = true
      g.running = false
      setPhase('error')
      setUiMessage('시간 데이터 예외가 감지되었습니다. 세션을 정리하는 중입니다.')
    }
  }

  const updateBullets = (delta: number) => {
    const g = gs.current
    for (const bullet of g.bullets) {
      bullet.x += bullet.vx * delta
      bullet.y += bullet.vy * delta
      if (bullet.growth) { bullet.r = Math.min(bullet.maxR || bullet.r, bullet.r + bullet.growth * delta) }
    }
    g.bullets = g.bullets.filter((b) => {
      const margin = b.r + 120
      return b.x > -margin && b.x < WIDTH + margin && b.y > -margin && b.y < HEIGHT + margin
    })
  }

  const updatePlayer = (delta: number) => {
    const g = gs.current
    const target = getPlayerTarget()
    const lerp = 1 - Math.pow(0.000001, delta)
    g.playerX += (target.x - g.playerX) * lerp
    g.playerY += (target.y - g.playerY) * lerp
    g.playerX = Math.max(g.playerRadius, Math.min(WIDTH - g.playerRadius, g.playerX))
    g.playerY = Math.max(g.playerRadius, Math.min(HEIGHT - g.playerRadius, g.playerY))
  }

  const getTriggeredEndingKey = (): string | null => {
    const g = gs.current
    switch (g.currentRoute) {
      case 'normal': return 'normalFail'
      case 'instant': return g.instantTriggered ? 'instant' : null
      case 'hope': return g.hopeTrapPhase >= 2 ? 'hope' : null
      case 'pattern': return g.patternWaveIndex >= 4 ? 'pattern' : null
      case 'hudDrop': return g.hudDropWave >= 0 ? 'hudDrop' : null
      case 'bigBullet': return g.bigBulletSpawned ? 'bigBullet' : null
      case 'darkness': return g.darknessPauseTriggered ? 'darkness' : null
      case 'growth': return g.playerRadius >= 16 ? 'growth' : null
      case 'drift': return g.driftWarningShown ? 'drift' : null
      case 'wall': return g.wallPhase >= 2 ? 'wall' : null
      case 'reward': return g.rewardTrapPhase >= 1 ? 'reward' : null
      case 'error59': return null
      default: return null
    }
  }

  const endRun = useCallback((key: string, title: string, description: string) => {
    const g = gs.current
    g.running = false
    g.paused = false
    g.pauseReason = 'none'
    const isNew = !g.collected.includes(key)
    if (isNew) { g.collected.push(key); saveCollection(g.collected) }
    setCollected([...g.collected])
    setPhase('result')
    setResultInfo({
      title,
      description,
      footer: isNew ? '획득한 결과는 보관함에 자동 저장됩니다.' : '이미 보유한 기록입니다. 새 해금은 없습니다.',
    })
    setUiMessage(isNew
      ? title + ' 기록이 저장되었습니다. 다른 패턴에서도 결과를 확인해 보세요.'
      : title + ' 기록은 이미 보유 중입니다.')
  }, [])

  const endRunByKey = useCallback((key: string) => {
    const data = ENDINGS[key]
    if (!data) return
    endRun(key, getEndingTitle(key), data.description)
  }, [endRun])

  const endSessionWithoutUnlock = useCallback((title: string, description: string, footerText?: string, messageTextValue?: string) => {
    const g = gs.current
    g.running = false
    g.paused = false
    g.pauseReason = 'none'
    setPhase('result')
    setResultInfo({
      title,
      description,
      footer: footerText || '이번 세션은 참고 기록으로만 종료되었습니다.',
    })
    setUiMessage(messageTextValue || '60초 도달로 세션이 종료되었습니다. 다음 패턴에서 다른 기록을 확인해 보세요.')
  }, [])

  const hitTest = useCallback(() => {
    const g = gs.current
    for (const bullet of g.bullets) {
      let collided = false
      if (bullet.kind === 'hudDrop') {
        const halfW = (bullet.w || 0) / 2
        const halfH = (bullet.h || 0) / 2
        const closestX = Math.max(bullet.x - halfW, Math.min(g.playerX, bullet.x + halfW))
        const closestY = Math.max(bullet.y - halfH, Math.min(g.playerY, bullet.y + halfH))
        const dx = g.playerX - closestX
        const dy = g.playerY - closestY
        collided = dx * dx + dy * dy < g.playerRadius * g.playerRadius
      } else {
        const dx = bullet.x - g.playerX
        const dy = bullet.y - g.playerY
        collided = Math.hypot(dx, dy) < bullet.r + g.playerRadius
      }
      if (collided) {
        const endingKey = getTriggeredEndingKey()
        endRunByKey(endingKey || 'normalFail')
        return true
      }
    }
    return false
  }, [endRunByKey])

  // ─── Route-specific update ─────────────────────────────

  const updateRoute = useCallback((delta: number) => {
    const g = gs.current

    if (g.currentRoute === 'normal') { spawnNormalPattern(delta); return }

    if (g.currentRoute === 'instant') {
      if (g.time < 0.7) setUiHudHint('시작 신호 대기 중')
      else if (g.time < 1.05) setUiHudHint('초기 패턴이 즉시 주입됩니다')
      else setUiHudHint('회피 경로가 열리기 전에 닫힙니다')
      if (g.time > 0.92 && !g.instantTriggered) {
        g.instantTriggered = true
        const targetX = Math.max(160, Math.min(WIDTH - 160, g.playerX))
        for (let i = -2; i <= 2; i++) spawnBullet(targetX + i * 36, -90, 0, 1680, 18, 'rgba(251,113,133,0.98)')
        spawnBullet(-90, g.playerY - 24, 1320, 0, 16, 'rgba(251,191,36,0.96)')
        spawnBullet(WIDTH + 90, g.playerY + 24, -1320, 0, 16, 'rgba(251,191,36,0.96)')
      }
      return
    }

    if (g.currentRoute === 'hope') {
      spawnNormalPattern(delta * (g.time < 12.8 ? 0.46 : g.time < 15 ? 0.12 : 0.08))
      if (g.time < 9.6) setUiHudHint('밀도가 낮게 유지됩니다')
      else if (g.time < 12.8) setUiHudHint('이 정도면 끝까지 갈 수 있어 보입니다')
      else if (g.time < 15.1) setUiHudHint('거의 다 정리된 것처럼 보입니다')
      else setUiHudHint('안쪽에서 닫히는 패턴이 시작됩니다')
      if (g.time > 12.9 && g.hopeTrapPhase === 0) {
        g.hopeTrapPhase = 1
        setUiMessage('패턴이 안정화되었습니다. 이 흐름이면 끝까지 갈 수 있습니다.')
      }
      if (g.time > 15.1 && g.hopeTrapPhase === 1) {
        g.hopeTrapPhase = 2
        const centerX = Math.max(220, Math.min(WIDTH - 220, g.playerX))
        const centerY = Math.max(180, Math.min(HEIGHT - 180, g.playerY))
        for (let i = 0; i < 14; i++) {
          const angle = (Math.PI * 2 * i) / 14
          const startX = centerX + Math.cos(angle) * 240
          const startY = centerY + Math.sin(angle) * 240
          const speed = i % 2 === 0 ? 300 : 360
          spawnBullet(startX, startY, -Math.cos(angle) * speed, -Math.sin(angle) * speed, 14, 'rgba(251,191,36,0.98)')
        }
        for (const angle of [Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4]) {
          spawnBullet(centerX + Math.cos(angle) * 310, centerY + Math.sin(angle) * 310, -Math.cos(angle) * 520, -Math.sin(angle) * 520, 18, 'rgba(251,113,133,0.98)')
        }
      }
      return
    }

    if (g.currentRoute === 'pattern') {
      const wave = Math.floor((g.time - 2.4) / 2.75)
      if (wave < 0) spawnNormalPattern(delta * 0.1)
      if (wave > 4) spawnNormalPattern(delta * 0.12)
      setUiHudHint(wave < 1 ? '반복 패턴 분석 중' : wave < 4 ? '같은 구조가 다시 나옵니다' : '방금 외운 경로를 그대로 유지하세요')
      if (wave >= 0 && wave < 5 && wave !== g.patternWaveIndex) {
        g.patternWaveIndex = wave
        const betrayed = wave === 4
        const gapIndex = betrayed ? 10 : 4
        const safeSpan = betrayed ? 2 : 3
        for (const speed of [155, 220, 290]) {
          const offset = betrayed ? Math.PI / 20 : 0
          for (let i = 0; i < 20; i++) {
            const safe = i >= gapIndex && i < gapIndex + safeSpan
            if (safe) continue
            const angle = (Math.PI * 2 * i) / 20 + offset
            const radius = speed === 155 ? 11 : speed === 220 ? 9 : 8
            spawnBullet(WIDTH / 2, HEIGHT / 2, Math.cos(angle) * speed, Math.sin(angle) * speed, radius, 'rgba(125,211,252,0.95)')
          }
        }
        if (wave === 2) setUiMessage('반복 패턴 분석 완료. 이제 보입니다.')
        if (betrayed) {
          const rememberedAngle = ((4 + 1.5) / 20) * Math.PI * 2
          for (const speed of [250, 340, 430]) {
            spawnBullet(WIDTH / 2, HEIGHT / 2, Math.cos(rememberedAngle) * speed, Math.sin(rememberedAngle) * speed, 10, 'rgba(251,113,133,0.98)')
          }
          setUiMessage('방금 외운 길이 마지막 한 번 바뀝니다.')
        }
      }
      return
    }

    if (g.currentRoute === 'hudDrop') {
      spawnNormalPattern(delta * (g.time < 8.2 ? 0.3 : g.time < 13 ? 0.12 : 0.08))
      if (g.time < 7.8) setUiHudHint('상단 인터페이스 동기화 중')
      else if (g.time < 10.4) setUiHudHint('상단 인터페이스가 흔들립니다')
      else setUiHudHint('표시 요소가 아래로 떨어집니다')
      if (g.time > 7.9 && !g.hudDropWarningShown) {
        g.hudDropWarningShown = true
        setUiMessage('상단 인터페이스 고정이 풀리기 시작합니다.')
      }
      const wave = Math.floor((g.time - 8.2) / 0.72)
      if (wave >= 0 && wave < 10 && wave !== g.hudDropWave) {
        g.hudDropWave = wave
        const labels = [
          g.displayedTime.toFixed(2) + '초',
          'LV ' + g.level,
          publicRouteLabel(g.currentRoute),
          '표시 요소가 아래로 떨어집니다'
        ]
        const primarySlot = wave % 4
        spawnHudDropBullet(labels[primarySlot], primarySlot, wave)
        if (wave >= 4) {
          const secondarySlot = (primarySlot + 2 + (wave % 2)) % 4
          spawnHudDropBullet(labels[secondarySlot], secondarySlot, wave + 0.5)
        }
        if (wave >= 7) spawnRing(8, 155, 8, g.time * 0.34)
      }
      return
    }

    if (g.currentRoute === 'bigBullet') {
      if (g.time < 4.8) { spawnNormalPattern(delta * 0.72); setUiHudHint('전방 반응이 커지고 있습니다') }
      if (g.time > 4.8 && !g.bigBulletWarningShown) {
        g.bigBulletWarningShown = true
        setUiMessage('전방에서 대형 반응이 감지되었습니다. 회피 경로를 재조정하세요.')
      }
      if (g.time > 4.8 && g.time < 5.6) setUiHudHint('대형 객체 접근 경고')
      else if (g.time >= 5.6 && g.time < 6.5) setUiHudHint('생각보다 훨씬 빠르게 커집니다')
      else if (g.time >= 6.5) setUiHudHint('남은 탈출 경로까지 닫히기 시작합니다')
      if (g.time > 5.4 && !g.bigBulletSpawned) {
        g.bigBulletSpawned = true
        g.bullets.push({
          kind: 'behemoth', x: WIDTH + 150, y: Math.max(140, Math.min(HEIGHT - 140, g.playerY)),
          vx: -245, vy: 0, r: 42, growth: 520, maxR: Math.min(WIDTH, HEIGHT) * 0.92,
          color: 'rgba(251,113,133,0.94)'
        })
      }
      if (g.time > 6.18 && g.bigBulletTrapPhase === 0) {
        g.bigBulletTrapPhase = 1
        const exitY = Math.max(110, Math.min(HEIGHT - 110, g.playerY))
        for (let i = -2; i <= 2; i++) spawnBullet(-90, exitY + i * 62, 980, 0, 16, 'rgba(251,191,36,0.96)')
        setUiMessage('외곽 회피 경로가 차단됩니다.')
      }
      return
    }

    if (g.currentRoute === 'darkness') {
      spawnNormalPattern(delta * 0.74)
      if (!g.darknessAdjusted) {
        g.darknessAlpha = Math.min(0.82, g.time / 15)
        if (g.time > 8.6 && !g.darknessPauseTriggered) {
          g.paused = true
          g.pauseReason = 'brightness'
          g.darknessPauseTriggered = true
          setPhase('brightness')
          setUiMessage('화면이 지나치게 어두워졌습니다. 디바이스 밝기를 올린 뒤 계속 진행하세요.')
          return
        }
        setUiHudHint(g.time > 6 ? '시야가 조금씩 줄어듭니다' : '주변 광량이 낮아지고 있습니다')
      } else {
        g.darknessAlpha = Math.min(0.98, 0.32 + Math.max(0, g.time - 8.6) / 8.6)
        setUiHudHint(g.time > 15 ? '밝기를 올려도 어둠이 더 빨라집니다' : '밝기 조정 후 테스트 재개')
      }
      if (g.time > 20) spawnRing(14, 250, 9, g.time)
      return
    }

    if (g.currentRoute === 'growth') {
      spawnNormalPattern(delta * (g.time < 16 ? 0.9 : 0.84))
      if (g.time < 11) { g.playerRadius = 10; setUiHudHint('기본 패턴 분석 중') }
      else if (g.time < 16) { g.playerRadius = 10 + (g.time - 11) * 0.7; setUiHudHint('기체 외곽선이 조금 퍼집니다') }
      else {
        g.playerRadius = 13.5 + (g.time - 16) * 3.9
        setUiHudHint(g.time < 21 ? '기체가 서서히 커지고 있습니다' : '피격 판정이 지나치게 정직해집니다')
      }
      if (g.time > 14.5 && !g.growthWarningShown) {
        g.growthWarningShown = true
        setUiMessage('외곽 충돌 반응이 비정상적으로 증가하고 있습니다.')
      }
      return
    }

    if (g.currentRoute === 'drift') {
      spawnNormalPattern(delta * (g.time < 14 ? 0.88 : 0.8))
      if (g.time < 9) setUiHudHint('입력 지연 없음')
      else if (g.time < 14) setUiHudHint('입력 오차가 천천히 누적됩니다')
      else setUiHudHint('포인터와 기체 위치가 점점 어긋납니다')
      if (g.time > 10.8 && !g.driftWarningShown) {
        g.driftWarningShown = true
        setUiMessage('기체 추적 오차가 발생하기 시작합니다.')
      }
      if (g.time > 19) spawnRing(12, 220, 9, g.time * 0.72)
      return
    }

    if (g.currentRoute === 'wall') {
      spawnNormalPattern(delta * (g.time < 10.6 ? 0.36 : 0.22))
      if (g.time <= 10.6) setUiHudHint('안전 구간을 탐색하는 중입니다')
      if (g.time > 10.6 && g.wallPhase === 0) {
        g.wallPhase = 1
        g.wallGapIndex = Math.max(3, Math.min(15, Math.floor(g.playerY / 32) - 1))
        for (let i = 0; i < 22; i++) {
          const skip = i >= g.wallGapIndex && i <= g.wallGapIndex + 3
          if (skip) continue
          const y = 12 + i * 32
          spawnBullet(-100, y, 760, 0, 15, 'rgba(244,114,182,0.98)')
          spawnBullet(WIDTH + 100, y, -760, 0, 15, 'rgba(244,114,182,0.98)')
        }
        setUiHudHint('중앙에 안전 통로가 형성됩니다')
        setUiMessage('정면에 넓은 안전 통로가 탐지되었습니다.')
      }
      if (g.time > 11.7 && g.wallPhase === 1) setUiHudHint('이 통로면 충분해 보입니다')
      if (g.time > 12.32 && g.wallPhase === 1) {
        g.wallPhase = 2
        const laneY = 12 + (g.wallGapIndex + 1.5) * 32
        for (let i = g.wallGapIndex + 1; i <= g.wallGapIndex + 2; i++) {
          const y = 12 + i * 32 + 4
          spawnBullet(-140, y, 1220, 0, 18, 'rgba(251,191,36,0.98)')
          spawnBullet(WIDTH + 140, y, -1220, 0, 18, 'rgba(251,191,36,0.98)')
        }
        spawnBullet(WIDTH / 2 - 40, laneY - 190, 0, 860, 15, 'rgba(251,191,36,0.98)')
        spawnBullet(WIDTH / 2 + 40, laneY + 190, 0, -860, 15, 'rgba(251,191,36,0.98)')
        setUiHudHint('방금 보였던 안전 통로가 닫힙니다')
        setUiMessage('안전 구간이 다시 계산됩니다.')
      }
      if (g.time > 13.06 && g.wallPhase === 2) {
        g.wallPhase = 3
        const trapX = Math.max(220, Math.min(WIDTH - 220, g.playerX))
        for (let i = 0; i < 8; i++) {
          const x = trapX - 196 + i * 56
          spawnBullet(x, -80, 0, 980, 14, 'rgba(251,191,36,0.96)')
          spawnBullet(x + 28, HEIGHT + 80, 0, -980, 14, 'rgba(251,191,36,0.96)')
        }
        setUiHudHint('빠져나온 구간도 다시 닫힙니다')
        setUiMessage('안전 구간이 한 번 더 재계산됩니다.')
      }
      return
    }

    if (g.currentRoute === 'reward') {
      spawnNormalPattern(delta * 0.76)
      if (g.time < 13.2) setUiHudHint('생존 데이터 집계 중')
      else if (g.time < 17.8) setUiHudHint('오류창 출력 중')
      else setUiHudHint('오류창 종료 직후 패턴이 재개됩니다')
      if (g.time > 13.1 && !g.rewardWarningShown) {
        g.rewardWarningShown = true
        setUiMessage('시스템 상태를 확인하는 중입니다.')
      }
      if (g.time > 15.1 && g.rewardTrapPhase === 0) {
        g.rewardTrapPhase = 1
        for (let i = 0; i < 10; i++) {
          const x = 80 + i * 125
          spawnBullet(x, -40, 0, 320, 12, 'rgba(250,204,21,0.95)')
          spawnBullet(x + 40, HEIGHT + 40, 0, -320, 12, 'rgba(250,204,21,0.95)')
        }
      }
      if (g.time > 16.4 && g.rewardTrapPhase === 1) {
        g.rewardTrapPhase = 2
        spawnRing(14, 210, 9, g.time * 0.5)
      }
      return
    }

    if (g.currentRoute === 'error59') {
      spawnNormalPattern(delta * (g.time < 26 ? 0.08 : 0.12))
      if (g.displayedTime < 20) setUiHudHint('이번 세션은 30초로 단축됩니다')
      else if (g.displayedTime < 27.2) setUiHudHint('시간이 조금씩 느려지기 시작합니다')
      else setUiHudHint('타이머 응답이 불안정합니다')
      const pulse = Math.floor((g.displayedTime - 27.5) / 0.5)
      if (pulse >= 0 && pulse < 3 && pulse !== g.errorPulseCount) {
        g.errorPulseCount = pulse
        spawnRing(10 + pulse * 2, 145 + pulse * 20, 8, g.time * 0.32)
      }
    }
  }, [])

  // ─── Game loop ─────────────────────────────────────────

  const finishRunAtTarget = useCallback(() => {
    const g = gs.current
    if (!g.running) return
    if (g.currentRoute === 'normal') { endRunByKey('normalFail'); return }
    endSessionWithoutUnlock(
      '60.00초 기록 달성',
      '예정된 사고 구간을 넘겼습니다. 이번 세션은 결과 확인용으로 종료됩니다.',
      '이번 세션은 참고 기록으로만 종료되었습니다.',
      '60초 도달로 세션이 종료되었습니다. 다음 패턴에서 다른 기록을 확인해 보세요.'
    )
  }, [endRunByKey, endSessionWithoutUnlock])

  const syncUI = useCallback(() => {
    const g = gs.current
    const target = getSessionTarget(g.currentRoute)
    setUiTime(g.displayedTime.toFixed(2))
    setUiLevel(g.level)
    setUiProgress(Math.min(100, (g.displayedTime / target) * 100))
    setUiAttempts(g.attempts)
    setUiRoute(g.currentRoute)
    setUiHudOpacity(g.currentRoute === 'hudDrop' && g.running && g.hudDropWave >= 0 ? 0.18 : 1)
  }, [])

  const loop = useCallback((timestamp: number) => {
    const g = gs.current
    if (!g.running && !g.paused) { renderScene(); syncUI(); return }
    if (g.paused) { renderScene(); syncUI(); animFrameRef.current = requestAnimationFrame(loop); return }
    if (!g.lastTimestamp) g.lastTimestamp = timestamp
    let delta = (timestamp - g.lastTimestamp) / 1000
    if (delta > 0.033) delta = 0.033
    g.lastTimestamp = timestamp
    g.time += delta
    updateLevel()
    updateDisplayedTime(delta)
    if (!g.running) { renderScene(); syncUI(); return }
    if (g.currentRoute !== 'error59' && g.time >= getSessionTarget(g.currentRoute)) {
      finishRunAtTarget()
      renderScene(); syncUI(); return
    }
    updatePlayer(delta)
    updateRoute(delta)
    if (g.paused) { renderScene(); syncUI(); animFrameRef.current = requestAnimationFrame(loop); return }
    updateBullets(delta)
    hitTest()
    renderScene()
    syncUI()
    if (g.running) animFrameRef.current = requestAnimationFrame(loop)
  }, [renderScene, syncUI, updateRoute, hitTest, finishRunAtTarget])

  // ─── Actions ───────────────────────────────────────────

  const startGame = useCallback(() => {
    const g = gs.current
    g.attempts += 1
    g.running = true; g.time = 0; g.displayedTime = 0; g.level = 1
    g.bullets = []; g.particles = []; g.playerRadius = 10
    g.playerX = WIDTH / 2; g.playerY = HEIGHT / 2; g.mouseX = WIDTH / 2; g.mouseY = HEIGHT / 2
    g.currentRoute = ROUTES[(g.attempts - 1) % ROUTES.length]
    g.lastTimestamp = 0; g.darknessAlpha = 0; g.paused = false; g.pauseReason = 'none'
    g.darknessAdjusted = false; g.darknessPauseTriggered = false
    g.instantTriggered = false; g.hopeTrapPhase = 0; g.patternWaveIndex = -1
    g.hudDropWave = -1; g.hudDropWarningShown = false
    g.growthWarningShown = false; g.driftWarningShown = false
    g.wallPhase = 0; g.wallGapIndex = 0
    g.rewardWarningShown = false; g.rewardTrapPhase = 0
    g.bigBulletSpawned = false; g.bigBulletWarningShown = false; g.bigBulletTrapPhase = 0
    g.errorPulseCount = -1; g.errorTriggered = false
    if (g.currentRoute === 'error59') {
      setUiMessage('시스템 안정성 점검으로 이번 세션 목표 시간이 30초로 조정되었습니다. 30초만 버티면 됩니다.')
    } else {
      setUiMessage(publicRouteLabel(g.currentRoute) + ' 분석 시작. 초반 흐름을 읽고 안전 구간을 확보하세요.')
    }
    setPhase('playing')
    setResultInfo(null)
    cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(loop)
  }, [loop])

  const openCollection = useCallback(() => {
    const g = gs.current
    if (g.running && !g.paused) {
      g.paused = true; g.pauseReason = 'collection'; g.lastTimestamp = 0
    }
    setPhase('collection')
  }, [])

  const closeCollection = useCallback(() => {
    const g = gs.current
    if (g.pauseReason === 'collection') {
      g.paused = false; g.pauseReason = 'none'; g.lastTimestamp = 0
      if (g.running) {
        setPhase('playing')
        animFrameRef.current = requestAnimationFrame(loop)
      } else {
        setPhase(resultInfo ? 'result' : 'idle')
      }
    } else {
      setPhase(resultInfo ? 'result' : 'idle')
    }
  }, [loop, resultInfo])

  const resetCollection = useCallback(() => {
    if (!confirm('정말 기록을 초기화할까요? 저장된 결과가 모두 삭제됩니다.')) return
    gs.current.collected = []
    saveCollection([])
    setCollected([])
    setUiMessage('기록이 초기화되었습니다. 새 세션부터 다시 누적됩니다.')
  }, [])

  const resumeAfterBrightness = useCallback(() => {
    const g = gs.current
    if (g.pauseReason !== 'brightness') return
    g.paused = false; g.pauseReason = 'none'; g.darknessAdjusted = true; g.lastTimestamp = 0
    setPhase('playing')
    setUiMessage('밝기 조정을 마쳤습니다. 테스트를 다시 시작합니다.')
    animFrameRef.current = requestAnimationFrame(loop)
  }, [loop])

  const restartAfterError = useCallback(() => {
    setPhase('idle')
    endRunByKey('error59')
  }, [endRunByKey])

  // ─── Mouse / Touch ────────────────────────────────────

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    gs.current.mouseX = (e.clientX - rect.left) * (WIDTH / rect.width)
    gs.current.mouseY = (e.clientY - rect.top) * (HEIGHT / rect.height)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    gs.current.mouseX = (touch.clientX - rect.left) * (WIDTH / rect.width)
    gs.current.mouseY = (touch.clientY - rect.top) * (HEIGHT / rect.height)
  }, [])

  // ─── Keyboard ──────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'collection') closeCollection()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [phase, closeCollection])

  // ─── Initial render ────────────────────────────────────

  useEffect(() => { renderScene() }, [renderScene])

  // ─── Derived UI ────────────────────────────────────────

  const target = getSessionTarget(uiRoute)
  const pauseLabel = phase === 'collection' ? '상태 기록 확인 중' : phase === 'brightness' ? '상태 밝기 조정 중' : null
  const routeStatusText = pauseLabel || (phase === 'playing' ? '상태 ' + publicRouteLabel(uiRoute) : '상태 준비중')
  const hudModeText = phase === 'collection' ? '기록 확인' : phase === 'brightness' ? '밝기 조정' : phase === 'playing' ? publicRouteLabel(uiRoute) : '대기'

  // ─── Render ────────────────────────────────────────────

  return (
    <div className={s.dodgeRoot}>
      <div className={s.app}>
        {/* Left Panel */}
        <section className={s.panel}>
          <div className={s.panelHeader}>
            <h1 className={s.title}>Zero Trace</h1>
            <p className={s.sub}>제한 시간 60초. 움직임을 유지하면서 밀려오는 탄막을 피하세요. 기록은 자동 저장되며, 반복 플레이 데이터가 누적됩니다.</p>
          </div>
          <div className={s.panelBody}>
            <div className={s.badgeRow}>
              <div className={s.badge}>도전 {uiAttempts}회</div>
              <div className={s.badge}>기록 {getCollectedCount(collected)} / {TOTAL_VISIBLE_COLLECTION}</div>
              <div className={s.badge}>{routeStatusText}</div>
            </div>

            <div className={s.meter}>
              <div className={s.meterHead}>
                <span>생존 진행도</span>
                <span>{uiTime} / {target.toFixed(2)}초</span>
              </div>
              <div className={s.bar}>
                <div className={s.barFill} style={{ width: uiProgress + '%' }} />
              </div>
            </div>

            <div className={s.statusBox}>
              <div className={s.statusLabel}>현재 단계</div>
              <div className={s.statusValue}>LV {uiLevel}</div>
            </div>

            <div className={s.statusBox}>
              <div className={s.statusLabel}>충돌 규칙</div>
              <div className={s.statusValue}>1회 피격 시 종료</div>
              <div className={s.statusDetail}>기체는 한 번만 맞아도 세션이 끝납니다. 안전 구간보다 충돌 여유를 먼저 확보하세요.</div>
            </div>

            <div className={s.statusBox}>
              <div className={s.statusLabel}>운영 로그</div>
              <div>{uiMessage}</div>
            </div>

            <div className={s.btnGrid}>
              <button className={`${s.btn} ${s.primaryBtn}`} onClick={startGame}>게임 시작</button>
              <button className={`${s.btn} ${s.secondaryBtn}`} onClick={openCollection}>기록 보관함</button>
              <button className={`${s.btn} ${s.dangerBtn}`} onClick={resetCollection}>기록 초기화</button>
            </div>

            <div className={s.tipBox}>
              <strong>플레이 팁</strong><br />
              마우스나 터치로 흰색 기체를 움직여 탄막을 회피하세요.<br />
              플레이 기록은 자동 저장되며, 반복 도전 시 보관함 정보가 갱신됩니다.
            </div>
          </div>
        </section>

        {/* Right Panel - Canvas */}
        <section className={s.panel}>
          <div className={s.panelBody}>
            <div className={s.canvasWrap}>
              <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onMouseMove={onMouseMove} onTouchMove={onTouchMove} />

              {/* HUD */}
              <div className={s.topHud} style={{ opacity: uiHudOpacity }}>
                <div className={s.hudGroup}>
                  <div className={s.hudPill}>{uiTime}초</div>
                  <div className={s.hudPill}>LV {uiLevel}</div>
                  <div className={s.hudPill}>{hudModeText}</div>
                </div>
                <div className={s.hudGroup}>
                  <div className={s.hudPill}>{uiHudHint}</div>
                </div>
              </div>

              {/* Start Overlay */}
              {phase === 'idle' && (
                <div className={s.overlay}>
                  <div className={s.overlayCard}>
                    <div className={s.heroTitle}>SURVIVAL TEST</div>
                    <p className={s.heroSub}>
                      포인터로 기체를 이동시켜 60초 동안 탄막을 버티세요.<br />
                      회차별 기록은 자동 저장되며, 축적된 결과는 보관함에서 확인할 수 있습니다.
                    </p>
                    <div className={s.heroActions}>
                      <button className={`${s.btn} ${s.primaryBtn}`} onClick={startGame}>테스트 시작</button>
                      <button className={`${s.btn} ${s.secondaryBtn}`} onClick={openCollection}>기록 보기</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Result Overlay */}
              {phase === 'result' && resultInfo && (
                <div className={s.overlay}>
                  <div className={s.overlayCard}>
                    <div className={s.heroTitle} style={{ fontSize: 36 }}>{resultInfo.title}</div>
                    <p className={s.heroSub}>{resultInfo.description}</p>
                    <div className={s.heroActions}>
                      <button className={`${s.btn} ${s.primaryBtn}`} onClick={startGame}>다시 시작</button>
                      <button className={`${s.btn} ${s.secondaryBtn}`} onClick={openCollection}>기록 보관함</button>
                    </div>
                    <p className={s.footerNote}>{resultInfo.footer}</p>
                  </div>
                </div>
              )}

              {/* Error Modal */}
              {phase === 'error' && (
                <div className={`${s.modal} ${s.errorModal}`}>
                  <div className={s.modalCard}>
                    <div className={s.errorTitle}>시스템 예외 감지</div>
                    <p className={s.heroSub}>
                      비정상적인 시간 축 데이터가 감지되었습니다.<br />
                      현재 세션을 종료하고 기록을 정리합니다.
                    </p>
                    <div className={s.errorList}>
                      - 세션 시간값이 허용 범위를 벗어났습니다<br />
                      - 표시 타이머와 내부 타이머의 동기화가 손상되었습니다<br />
                      - 무결성 확인을 위해 결과 처리 단계로 이동합니다
                    </div>
                    <div className={s.heroActions}>
                      <button className={`${s.btn} ${s.primaryBtn}`} onClick={restartAfterError}>세션 정리</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Brightness Modal */}
              {phase === 'brightness' && (
                <div className={s.modal}>
                  <div className={`${s.modalCard} ${s.brightnessCard}`}>
                    <div className={s.heroTitle} style={{ marginBottom: 12 }}>화면 보정 필요</div>
                    <p className={s.heroSub}>
                      현재 구간은 주변 조명과 화면 밝기에 큰 영향을 받습니다.<br />
                      디바이스 화면 밝기를 최대로 올린 뒤 계속 진행하세요.
                    </p>
                    <div className={s.brightnessPreview}>MAX BRIGHTNESS</div>
                    <div className={s.heroActions}>
                      <button className={`${s.btn} ${s.primaryBtn}`} onClick={resumeAfterBrightness}>밝기 올리고 계속하기</button>
                    </div>
                    <p className={s.footerNote}>재개 후 테스트가 즉시 이어집니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Collection Modal */}
      {phase === 'collection' && (
        <div className={s.modal} onClick={(e) => { if (e.target === e.currentTarget) closeCollection() }}>
          <div className={`${s.modalCard} ${s.collectionModalCard}`}>
            <h2 className={s.title} style={{ marginBottom: 8 }}>기록 보관함</h2>
            <p className={s.sub}>세션 결과가 누적 저장됩니다. 잠긴 기록은 조건을 만족하면 자동으로 열립니다.</p>
            <div className={s.collectionGrid}>
              {COLLECTION_ORDER.map((key) => {
                const data = ENDINGS[key]
                const unlocked = collected.includes(key)
                const name = unlocked ? data.name : key === 'fakeFinal' ? data.name : '???'
                const description = unlocked ? data.description : key === 'fakeFinal' ? data.description : '잠긴 기록입니다. 조건을 만족하면 상세 정보가 표시됩니다.'
                const footerText = unlocked ? '기록 저장 완료' : key === 'fakeFinal' ? '조건: ' + data.unlockHint : '조건: 비공개'
                const stateText = unlocked ? '획득 완료' : key === 'fakeFinal' ? '최종 기록' : '잠김'
                return (
                  <div key={key} className={`${s.endCard} ${unlocked ? s.endCardUnlocked : s.endCardLocked}`}>
                    <div className={s.endId}>{data.id}</div>
                    <div className={s.endState}>{stateText}</div>
                    <div className={s.endName}>{name}</div>
                    <div className={s.endDesc}>{description}</div>
                    <div className={s.footerNote}>{footerText}</div>
                  </div>
                )
              })}
            </div>
            <div className={s.heroActions}>
              <button className={`${s.btn} ${s.primaryBtn}`} onClick={closeCollection}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
