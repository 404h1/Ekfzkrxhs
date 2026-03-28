'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import s from './dodge.module.css'

// ─── Types ───────────────────────────────────────────────

type Route = 'normal' | 'instant' | 'hope' | 'pattern' | 'growth' | 'reward' | 'hudDrop' | 'drift' | 'darkness' | 'wall' | 'bigBullet' | 'error59'
type PauseReason = 'none' | 'collection' | 'brightness'
type Phase = 'idle' | 'playing' | 'result' | 'error' | 'brightness' | 'collection' | 'leaderboard' | 'roulette'

interface Bullet {
  x: number; y: number; vx: number; vy: number; r: number; color: string
  kind?: 'hudDrop' | 'behemoth'
  w?: number; h?: number; text?: string; border?: string; textColor?: string
  growth?: number; maxR?: number
}

interface EndingData {
  id: string; name: string; description: string; unlockHint: string
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number
  r: number; color: string
}

interface Star {
  x: number; y: number; size: number; speed: number; brightness: number
}

interface ScoreEntry {
  name: string; survival_time: number; created_at: string
}

interface GameState {
  running: boolean; attempts: number
  mouseX: number; mouseY: number; playerX: number; playerY: number; playerRadius: number
  time: number; displayedTime: number; level: number
  bullets: Bullet[]; particles: Particle[]
  trail: { x: number; y: number; alpha: number }[]
  stars: Star[]
  nearMissTimer: number
  shakeX: number; shakeY: number
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
  normalFail: { id: 'END 00', name: '평범한 죽음', description: '축하합니다. 가장 재미없는 방법으로 죽었습니다. 이것도 재능입니다.', unlockHint: '미확인' },
  instant: { id: 'END 01', name: '속도의 신', description: '시작 버튼을 누른 게 유일한 조작이었습니다. 스피드런 세계 기록 축하드려요.', unlockHint: '미확인' },
  hope: { id: 'END 02', name: '희망은 독입니다', description: '"이거 할 만한데?" 라고 생각한 순간이 정확히 사망 원인이었습니다.', unlockHint: '미확인' },
  pattern: { id: 'END 03', name: '공부는 배신한다', description: '패턴을 외웠죠? 게임도 당신을 외웠습니다.', unlockHint: '미확인' },
  growth: { id: 'END 04', name: '다이어트 실패', description: '좀 뚱뚱해진 건 기분 탓입니다. (아닙니다)', unlockHint: '미확인' },
  error59: { id: 'END 05', name: '시간은 돈이다 (거짓말)', description: '30초만 버티면 된다고 했죠? 만우절인데 왜 믿었어요?', unlockHint: '미확인' },
  reward: { id: 'END 06', name: '버그 아님 (거짓말)', description: '축하합니다! 버그를 발견하셨습니다! ...라고 할 뻔했죠?', unlockHint: '미확인' },
  hudDrop: { id: 'END 11', name: 'UI도 적이었다', description: 'HUD가 떨어지는 건 버그가 아니라 기능입니다. 진짜로요.', unlockHint: '미확인' },
  drift: { id: 'END 07', name: '손이 문제가 아님', description: '마우스는 정상입니다. 기체가 말을 안 듣는 건 사양입니다.', unlockHint: '미확인' },
  darkness: { id: 'END 08', name: '전기세 절약', description: '밝기를 올렸습니다. 어둠이 더 열심히 일하기 시작했습니다.', unlockHint: '미확인' },
  wall: { id: 'END 09', name: '안전지대 (웃음)', description: '"여기 안전하네!" 라고 생각한 0.3초가 참 행복했을 겁니다.', unlockHint: '미확인' },
  bigBullet: { id: 'END 10', name: '그건 좀 크지 않나', description: '작은 총알은 피했는데 화면 절반을 먹는 건 좀 억울하죠?', unlockHint: '미확인' },
  fakeFinal: { id: 'END 99', name: '진짜 엔딩 (아마도)', description: '이 엔딩은 실제로 존재합니다. 아마도요. 만우절이니까 모르겠네요.', unlockHint: '모든 기록 수집 후 무피격 60초 생존' },
}

const COLLECTION_ORDER = ['normalFail', 'instant', 'hope', 'pattern', 'growth', 'error59', 'reward', 'hudDrop', 'drift', 'darkness', 'wall', 'bigBullet', 'fakeFinal']
const TOTAL_VISIBLE_COLLECTION = 12

// ─── Helpers ─────────────────────────────────────────────

const NAME_STORAGE_KEY = 'april_fools_dodge_name_v1'
const PREFIXES = [
  '도망자', '생존자', '용감한', '무모한', '불쌍한', '희망찬', '절망의', '전설의', '평범한', '운 좋은',
  '운 나쁜', '겁 많은', '당당한', '몽롱한', '허무한', '화난', '졸린', '배고픈', '심심한', '외로운',
  '신나는', '슬픈', '멍때린', '까칠한', '순수한', '엉뚱한', '느긋한', '급한', '소심한', '대담한',
  '미스터', '미세스', '꼬마', '거대한', '투명한', '반짝이는', '어두운', '빛나는', '축축한', '건조한',
  '떨리는', '흔들리는', '미끄러진', '날아간', '굴러온', '숨은', '뛰쳐나온', '방황하는', '질주하는', '기어가는',
]
const SUFFIXES = [
  '감자', '고양이', '토끼', '햄스터', '펭귄', '오리', '두부', '떡볶이', '김밥', '라면',
  '치킨', '탕후루', '붕어빵', '호떡', '만두', '초코파이', '젤리곰', '솜사탕', '마카롱', '푸딩',
  '강아지', '다람쥐', '수달', '알파카', '카피바라', '너구리', '고슴도치', '미어캣', '판다', '코알라',
  '피자', '타코', '도넛', '와플', '크레페', '쿠키', '브라우니', '케이크', '빵', '국밥',
  '짬뽕', '우동', '곱창', '족발', '순대', '어묵', '핫도그', '감자튀김', '팝콘', '아이스크림',
]

function generateRandomName(): string {
  const num = Math.floor(Math.random() * 9000) + 1000
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)]
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]
  return '#' + num + ' ' + prefix + ' ' + suffix
}

async function generateUniqueName(): Promise<string> {
  try {
    const res = await fetch('/api/scores/names')
    if (!res.ok) return generateRandomName()
    const existingNames: string[] = await res.json()
    const nameSet = new Set(existingNames)
    for (let i = 0; i < 100; i++) {
      const candidate = generateRandomName()
      if (!nameSet.has(candidate)) return candidate
    }
  } catch { /* fallback */ }
  return generateRandomName()
}

function loadSavedName(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || ''
  } catch { return '' }
}

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
    normal: '평범한 지옥', instant: '깜짝 파티', hope: '희망 고문', pattern: '공부의 배신',
    growth: '다이어트 실패', reward: '가짜 버그', hudDrop: 'UI의 반란', bigBullet: '대왕 총알',
    drift: '손 탓 아님', darkness: '전기세 절약', wall: '안전 (웃음)', error59: '시간은 거짓말',
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

function createStars(): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 30 + 5,
      brightness: Math.random() * 0.6 + 0.2,
    })
  }
  return stars
}

function createInitialGameState(): GameState {
  return {
    running: false, attempts: 0,
    mouseX: WIDTH / 2, mouseY: HEIGHT / 2, playerX: WIDTH / 2, playerY: HEIGHT / 2, playerRadius: 10,
    time: 0, displayedTime: 0, level: 1,
    bullets: [], particles: [], trail: [], stars: createStars(),
    nearMissTimer: 0, shakeX: 0, shakeY: 0,
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
  const [uiMessage, setUiMessage] = useState('살아남으세요. 그게 전부입니다. (아마도)')
  const [uiTime, setUiTime] = useState('0.00')
  const [uiLevel, setUiLevel] = useState(1)
  const [uiProgress, setUiProgress] = useState(0)
  const [uiAttempts, setUiAttempts] = useState(0)
  const [uiRoute, setUiRoute] = useState<Route>('normal')
  const [uiHudHint, setUiHudHint] = useState('살아남으세요')
  const [uiHudOpacity, setUiHudOpacity] = useState(1)
  const [resultInfo, setResultInfo] = useState<{ title: string; description: string; footer: string } | null>(null)
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([])
  const [playerName, setPlayerName] = useState('')
  const [roulettePhase, setRoulettePhase] = useState<'spinning' | 'result' | 'reveal'>('spinning')
  const [roulettePrize, setRoulettePrize] = useState(0)
  const [rouletteAngle, setRouletteAngle] = useState(0)

  useEffect(() => {
    const saved = loadSavedName()
    if (saved) {
      setPlayerName(saved)
    } else {
      generateUniqueName().then((name) => {
        setPlayerName(name)
        localStorage.setItem(NAME_STORAGE_KEY, name)
      })
    }
  }, [])

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/scores')
      if (res.ok) setLeaderboard(await res.json())
    } catch { /* ignore */ }
  }, [])

  const saveScore = useCallback(async (survivalTime: number, route: string, ending: string) => {
    const name = playerName || '???'
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, survival_time: survivalTime, route, ending }),
      })
    } catch { /* ignore */ }
  }, [playerName])

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
    const g = gs.current
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT)
    gradient.addColorStop(0, '#0a0f1e')
    gradient.addColorStop(0.5, '#070b16')
    gradient.addColorStop(1, '#020408')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    // Animated stars
    for (const star of g.stars) {
      const twinkle = 0.5 + Math.sin(g.time * 2 + star.x * 0.01) * 0.3
      ctx.save()
      ctx.globalAlpha = star.brightness * twinkle
      ctx.fillStyle = '#c4d5f0'
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    // Subtle grid
    ctx.save()
    ctx.globalAlpha = 0.04
    ctx.strokeStyle = '#4a6fa5'
    ctx.lineWidth = 0.5
    for (let x = 0; x < WIDTH; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke() }
    for (let y = 0; y < HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke() }
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
      // Glow effect
      ctx.save()
      ctx.shadowColor = bullet.color
      ctx.shadowBlur = 12 + (bullet.growth ? 20 : 0)
      ctx.beginPath()
      ctx.fillStyle = bullet.color
      ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      // Outer ring
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.strokeStyle = bullet.color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(bullet.x, bullet.y, bullet.r + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      if (bullet.growth) {
        ctx.save()
        ctx.strokeStyle = 'rgba(254, 202, 202, 0.5)'
        ctx.lineWidth = 6
        ctx.shadowColor = 'rgba(251,113,133,0.6)'
        ctx.shadowBlur = 20
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, bullet.r + 18, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    for (const p of g.particles) {
      const life = p.life / p.maxLife
      ctx.save()
      ctx.globalAlpha = life * 0.8
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * life, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const g = gs.current
    // Draw trail
    for (let i = 0; i < g.trail.length; i++) {
      const t = g.trail[i]
      ctx.save()
      ctx.globalAlpha = t.alpha * 0.4
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.arc(t.x, t.y, g.playerRadius * (0.3 + t.alpha * 0.5), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    // Outer pulse ring
    const pulse = Math.sin(g.time * 4) * 3
    ctx.save()
    ctx.strokeStyle = g.nearMissTimer > 0 ? 'rgba(251,191,36,0.7)' : 'rgba(96,165,250,0.5)'
    ctx.lineWidth = 2
    ctx.shadowColor = g.nearMissTimer > 0 ? '#fbbf24' : '#60a5fa'
    ctx.shadowBlur = 15
    ctx.beginPath()
    ctx.arc(g.playerX, g.playerY, g.playerRadius + 10 + pulse, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    // Inner glow
    ctx.save()
    ctx.shadowColor = '#60a5fa'
    ctx.shadowBlur = 20
    const playerGrad = ctx.createRadialGradient(g.playerX, g.playerY, 0, g.playerX, g.playerY, g.playerRadius)
    playerGrad.addColorStop(0, '#ffffff')
    playerGrad.addColorStop(0.6, '#e0eaff')
    playerGrad.addColorStop(1, '#60a5fa')
    ctx.fillStyle = playerGrad
    ctx.beginPath()
    ctx.arc(g.playerX, g.playerY, g.playerRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
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
    ctx.fillText('이 오류는 진짜입니다 (아마도)', WIDTH / 2, y + 132)
    ctx.fillStyle = 'rgba(251,191,36,0.28)'
    ctx.fillRect(WIDTH / 2 - 180, y + 160, 360, 42)
    ctx.fillStyle = 'rgba(15,23,42,0.75)'
    ctx.font = '800 20px Arial'
    ctx.fillText('복구 중... (거짓말)', WIDTH / 2, y + 188)
    ctx.restore()
  }

  const renderScene = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const g = gs.current
    ctx.save()
    ctx.translate(g.shakeX, g.shakeY)
    drawBackground(ctx)
    drawBullets(ctx)
    drawParticles(ctx)
    drawDriftGuide(ctx)
    drawPlayer(ctx)
    drawDarkness(ctx)
    drawRewardBanner(ctx)
    ctx.restore()
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
    const cap = target - 0.001 // never reach exactly 60 or 30
    if (g.currentRoute !== 'error59') {
      // Always monotonically increasing, never exceed cap
      const next = Math.min(cap, g.time)
      g.displayedTime = Math.max(g.displayedTime, next)
      return
    }
    if (g.time < 20) {
      const next = Math.min(cap, g.time)
      g.displayedTime = Math.max(g.displayedTime, next)
    } else {
      if (g.displayedTime < 20) g.displayedTime = 20
      const slowProgress = Math.min(1, (g.time - 20) / 12)
      const rate = 1 - 0.6 * Math.pow(slowProgress, 1.6)
      const next = Math.min(cap, g.displayedTime + delta * rate)
      g.displayedTime = Math.max(g.displayedTime, next)
    }
    if ((g.displayedTime > 29.02 || g.time > 36) && !g.errorTriggered) {
      g.errorTriggered = true
      g.running = false
      setPhase('error')
      setUiMessage('시간이 멈춘 건 버그가 아닙니다. 당신만 늙고 있을 뿐이에요.')
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
    // Trail
    g.trail.unshift({ x: g.playerX, y: g.playerY, alpha: 1 })
    if (g.trail.length > 12) g.trail.pop()
    for (const t of g.trail) t.alpha *= 0.85
  }

  const updateStars = (delta: number) => {
    const g = gs.current
    for (const star of g.stars) {
      star.y += star.speed * delta
      if (star.y > HEIGHT) { star.y = -2; star.x = Math.random() * WIDTH }
    }
  }

  const updateParticles = (delta: number) => {
    const g = gs.current
    for (const p of g.particles) {
      p.x += p.vx * delta
      p.y += p.vy * delta
      p.life -= delta
    }
    g.particles = g.particles.filter(p => p.life > 0)
  }

  const checkNearMiss = (delta: number) => {
    const g = gs.current
    g.nearMissTimer = Math.max(0, g.nearMissTimer - delta)
    g.shakeX *= 0.85; g.shakeY *= 0.85
    for (const bullet of g.bullets) {
      if (bullet.kind === 'hudDrop') continue
      const dx = bullet.x - g.playerX
      const dy = bullet.y - g.playerY
      const dist = Math.hypot(dx, dy)
      const threshold = bullet.r + g.playerRadius + 20
      if (dist < threshold && dist > bullet.r + g.playerRadius) {
        g.nearMissTimer = 0.3
        // Spawn spark particles
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2
          g.particles.push({
            x: g.playerX + Math.cos(angle) * (g.playerRadius + 5),
            y: g.playerY + Math.sin(angle) * (g.playerRadius + 5),
            vx: Math.cos(angle) * (80 + Math.random() * 60),
            vy: Math.sin(angle) * (80 + Math.random() * 60),
            life: 0.4, maxLife: 0.4,
            r: 2 + Math.random() * 2,
            color: '#fbbf24',
          })
        }
        g.shakeX = (Math.random() - 0.5) * 4
        g.shakeY = (Math.random() - 0.5) * 4
        break
      }
    }
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
      footer: isNew ? '새로운 사망 방법을 수집했습니다! (축하해야 하나?)' : '같은 방법으로 또 죽었네요. 학습 능력이 의심됩니다.',
    })
    setUiMessage(isNew
      ? '새 엔딩 발견! ' + title + ' — 다른 죽는 법도 찾아보세요.'
      : title + ' — 이미 겪어본 죽음입니다. 기억력이 걱정되네요.')
    saveScore(g.displayedTime, g.currentRoute, key)
  }, [saveScore])

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
    saveScore(g.displayedTime, g.currentRoute, 'survived')
  }, [saveScore])

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
      if (g.time < 0.7) setUiHudHint('잠깐만요 준비 중...')
      else if (g.time < 1.05) setUiHudHint('거짓말이었습니다')
      else setUiHudHint('이미 늦었습니다 ㅎㅎ')
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
      if (g.time < 9.6) setUiHudHint('오 이거 쉬운데?')
      else if (g.time < 12.8) setUiHudHint('이제 쉬워지는 것 같죠?')
      else if (g.time < 15.1) setUiHudHint('네 맞아요 쉬워지고 있어요 (거짓말)')
      else setUiHudHint('ㅋㅋㅋㅋㅋㅋ')
      if (g.time > 12.9 && g.hopeTrapPhase === 0) {
        g.hopeTrapPhase = 1
        setUiMessage('이대로면 클리어할 수 있을 것 같아요! (개발자 웃음)')
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
      setUiHudHint(wave < 1 ? '이 패턴 외우세요' : wave < 4 ? '같은 패턴이에요 믿으세요' : '외운 길로 가세요 (절대 가지 마세요)')
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
        if (wave === 2) setUiMessage('보이시죠? 이제 다 외웠죠? 좋아요 좋아요~')
        if (betrayed) {
          const rememberedAngle = ((4 + 1.5) / 20) * Math.PI * 2
          for (const speed of [250, 340, 430]) {
            spawnBullet(WIDTH / 2, HEIGHT / 2, Math.cos(rememberedAngle) * speed, Math.sin(rememberedAngle) * speed, 10, 'rgba(251,113,133,0.98)')
          }
          setUiMessage('아 참, 마지막 판은 좀 다릅니다. 만우절이거든요.')
        }
      }
      return
    }

    if (g.currentRoute === 'hudDrop') {
      spawnNormalPattern(delta * (g.time < 8.2 ? 0.3 : g.time < 13 ? 0.12 : 0.08))
      if (g.time < 7.8) setUiHudHint('UI가 좀 불안해 보이는 건 기분 탓')
      else if (g.time < 10.4) setUiHudHint('UI가 흔들리는 건 지진 때문입니다')
      else setUiHudHint('UI도 적이 될 수 있다는 걸 배우세요')
      if (g.time > 7.9 && !g.hudDropWarningShown) {
        g.hudDropWarningShown = true
        setUiMessage('위에 있는 거 떨어져요. 머리 조심하세요~')
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
      if (g.time < 4.8) { spawnNormalPattern(delta * 0.72); setUiHudHint('뭔가 큰 게 오고 있어요') }
      if (g.time > 4.8 && !g.bigBulletWarningShown) {
        g.bigBulletWarningShown = true
        setUiMessage('뒤를 돌아보지 마세요. (이미 늦었지만)')
      }
      if (g.time > 4.8 && g.time < 5.6) setUiHudHint('...진짜 큽니다')
      else if (g.time >= 5.6 && g.time < 6.5) setUiHudHint('이건 좀 너무하지 않나요?')
      else if (g.time >= 6.5) setUiHudHint('도망칠 곳이 없어지고 있습니다 ㅎㅎ')
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
        setUiMessage('출구도 막아놨어요. 만우절 선물입니다.')
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
          setUiMessage('어두워진 건 당신 폰 문제입니다. (아님)')
          return
        }
        setUiHudHint(g.time > 6 ? '점점 안 보이는 건 노안이 아닙니다' : '슬슬 어두워지는 거 느끼셨나요?')
      } else {
        g.darknessAlpha = Math.min(0.98, 0.32 + Math.max(0, g.time - 8.6) / 8.6)
        setUiHudHint(g.time > 15 ? '밝기 올려봤자 소용없어요 ㅋㅋ' : '밝기 올렸죠? 어둠도 같이 올라왔어요')
      }
      if (g.time > 20) spawnRing(14, 250, 9, g.time)
      return
    }

    if (g.currentRoute === 'growth') {
      spawnNormalPattern(delta * (g.time < 16 ? 0.9 : 0.84))
      if (g.time < 11) { g.playerRadius = 10; setUiHudHint('지금은 날씬하네요') }
      else if (g.time < 16) { g.playerRadius = 10 + (g.time - 11) * 0.7; setUiHudHint('살이 좀 찐 것 같은데...') }
      else {
        g.playerRadius = 13.5 + (g.time - 16) * 3.9
        setUiHudHint(g.time < 21 ? '뚱뚱해진 건 기분 탓입니다 (아님)' : '이제 피하는 게 물리적으로 불가능')
      }
      if (g.time > 14.5 && !g.growthWarningShown) {
        g.growthWarningShown = true
        setUiMessage('기체가 커지는 건 버그가 아니라 체중 증가입니다.')
      }
      return
    }

    if (g.currentRoute === 'drift') {
      spawnNormalPattern(delta * (g.time < 14 ? 0.88 : 0.8))
      if (g.time < 9) setUiHudHint('조작감 완벽하죠?')
      else if (g.time < 14) setUiHudHint('조금 말 안 듣는 건 사양입니다')
      else setUiHudHint('마우스 탓 아닙니다 진짜로')
      if (g.time > 10.8 && !g.driftWarningShown) {
        g.driftWarningShown = true
        setUiMessage('기체가 말을 안 듣기 시작합니다. 마우스 문제 아니에요~')
      }
      if (g.time > 19) spawnRing(12, 220, 9, g.time * 0.72)
      return
    }

    if (g.currentRoute === 'wall') {
      spawnNormalPattern(delta * (g.time < 10.6 ? 0.36 : 0.22))
      if (g.time <= 10.6) setUiHudHint('안전한 곳을 찾고 있어요...')
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
        setUiHudHint('여기 안전해 보여요! 들어가세요!')
        setUiMessage('안전 통로 발견! 여기로 오세요! (절대 함정 아님)')
      }
      if (g.time > 11.7 && g.wallPhase === 1) setUiHudHint('편안하시죠? 잠깐만요...')
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
        setUiHudHint('ㅋㅋ 안전 통로 닫힘')
        setUiMessage('안전지대라고 했죠? 만우절이에요~')
      }
      if (g.time > 13.06 && g.wallPhase === 2) {
        g.wallPhase = 3
        const trapX = Math.max(220, Math.min(WIDTH - 220, g.playerX))
        for (let i = 0; i < 8; i++) {
          const x = trapX - 196 + i * 56
          spawnBullet(x, -80, 0, 980, 14, 'rgba(251,191,36,0.96)')
          spawnBullet(x + 28, HEIGHT + 80, 0, -980, 14, 'rgba(251,191,36,0.96)')
        }
        setUiHudHint('이번엔 진짜 끝입니다 (거짓말)')
        setUiMessage('도망친 곳도 막아놨어요. 꼼꼼하죠?')
      }
      return
    }

    if (g.currentRoute === 'reward') {
      spawnNormalPattern(delta * 0.76)
      if (g.time < 13.2) setUiHudHint('잠깐 시스템 점검할게요...')
      else if (g.time < 17.8) setUiHudHint('이 오류창 진짜입니다 (거짓말)')
      else setUiHudHint('오류창 닫히면 선물이 있어요~')
      if (g.time > 13.1 && !g.rewardWarningShown) {
        g.rewardWarningShown = true
        setUiMessage('축하합니다! 버그를 발견하셨습니다! (거짓말)')
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
      if (g.displayedTime < 20) setUiHudHint('30초만 버티면 됩니다! (진심)')
      else if (g.displayedTime < 27.2) setUiHudHint('시간이 좀 느린 건 기분 탓...')
      else setUiHudHint('29초에서 왜 안 넘어가죠? ㅎㅎ')
      const pulse = Math.floor((g.displayedTime - 27.5) / 0.5)
      if (pulse >= 0 && pulse < 3 && pulse !== g.errorPulseCount) {
        g.errorPulseCount = pulse
        spawnRing(10 + pulse * 2, 145 + pulse * 20, 8, g.time * 0.32)
      }
    }
  }, [])

  // ─── Game loop ─────────────────────────────────────────

  // ─── Roulette system ──────────────────────────────────
  const FAKE_PRIZES = [
    { emoji: '☕', name: '스타벅스 아메리카노', desc: '따뜻한 아메리카노 1잔 (Tall)', code: 'AFD-2026-COFFEE-XXXX' },
    { emoji: '🍕', name: '도미노피자 50% 할인', desc: '라지 사이즈 50% 할인 쿠폰', code: 'AFD-2026-PIZZA-XXXX' },
    { emoji: '🎬', name: 'CGV 영화 관람권', desc: '2D 일반 영화 1매', code: 'AFD-2026-MOVIE-XXXX' },
    { emoji: '🍦', name: '배스킨라빈스 싱글콘', desc: '싱글 레귤러 아이스크림 1개', code: 'AFD-2026-ICECR-XXXX' },
    { emoji: '🍔', name: '맥도날드 빅맥 세트', desc: '빅맥 + 후렌치후라이(M) + 콜라(M)', code: 'AFD-2026-BIGMC-XXXX' },
    { emoji: '🧋', name: '공차 밀크티 L', desc: '타로 밀크티 + 펄 추가', code: 'AFD-2026-GONCH-XXXX' },
    { emoji: '🎧', name: '에어팟 프로 3', desc: 'Apple AirPods Pro 3 (화이트)', code: 'AFD-2026-AIRPD-XXXX' },
    { emoji: '💰', name: '현금 100만원', desc: '계좌로 즉시 입금 (세후)', code: 'AFD-2026-MONEY-XXXX' },
  ]

  const startRoulette = useCallback(() => {
    const g = gs.current
    g.running = false
    g.paused = false
    g.pauseReason = 'none'
    saveScore(g.displayedTime, g.currentRoute, 'survived')

    const prize = Math.floor(Math.random() * FAKE_PRIZES.length)
    setRoulettePrize(prize)
    setRoulettePhase('spinning')
    setRouletteAngle(0)
    setPhase('roulette')

    // Spin animation: accelerate then decelerate over 4 seconds
    const totalDuration = 4000
    const targetAngle = 360 * 5 + (prize / FAKE_PRIZES.length) * 360 + Math.random() * 30
    const startTime = Date.now()

    const spin = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / totalDuration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setRouletteAngle(eased * targetAngle)

      if (progress < 1) {
        requestAnimationFrame(spin)
      } else {
        // Show fake prize after spin
        setTimeout(() => setRoulettePhase('result'), 600)
      }
    }
    requestAnimationFrame(spin)
  }, [saveScore])

  const finishRunAtTarget = useCallback(() => {
    const g = gs.current
    if (!g.running) return
    if (g.currentRoute === 'normal') { endRunByKey('normalFail'); return }
    startRoulette()
  }, [endRunByKey, startRoulette])

  const syncUI = useCallback(() => {
    const g = gs.current
    const target = getSessionTarget(g.currentRoute)
    setUiTime(g.displayedTime.toFixed(3))
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
    updateStars(delta)
    updateParticles(delta)
    checkNearMiss(delta)
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
    g.bullets = []; g.particles = []; g.trail = []; g.playerRadius = 10
    g.nearMissTimer = 0; g.shakeX = 0; g.shakeY = 0
    g.playerX = WIDTH / 2; g.playerY = HEIGHT / 2; g.mouseX = WIDTH / 2; g.mouseY = HEIGHT / 2
    g.currentRoute = ROUTES[Math.floor(Math.random() * ROUTES.length)]
    g.lastTimestamp = 0; g.darknessAlpha = 0; g.paused = false; g.pauseReason = 'none'
    g.darknessAdjusted = false; g.darknessPauseTriggered = false
    g.instantTriggered = false; g.hopeTrapPhase = 0; g.patternWaveIndex = -1
    g.hudDropWave = -1; g.hudDropWarningShown = false
    g.growthWarningShown = false; g.driftWarningShown = false
    g.wallPhase = 0; g.wallGapIndex = 0
    g.rewardWarningShown = false; g.rewardTrapPhase = 0
    g.bigBulletSpawned = false; g.bigBulletWarningShown = false; g.bigBulletTrapPhase = 0
    g.errorPulseCount = -1; g.errorTriggered = false
    // Reset mascots for new route
    delete mascotRef.current[g.currentRoute]
    if (g.currentRoute === 'error59') {
      setUiMessage('특별 할인! 이번엔 30초만 버티면 됩니다. 쉽죠? (만우절)')
    } else {
      setUiMessage(publicRouteLabel(g.currentRoute) + ' 시작! 행운을 빕니다. (필요할 거예요)')
    }
    setPhase('playing')
    setResultInfo(null)
    setUiTime('0.000')
    setUiLevel(1)
    setUiProgress(0)
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
    if (!confirm('정말 초기화요? 그 고생을 또 하실 건가요?')) return
    gs.current.collected = []
    saveCollection([])
    setCollected([])
    setUiMessage('전부 지웠습니다. 다시 죽으러 가시죠.')
  }, [])

  const resumeAfterBrightness = useCallback(() => {
    const g = gs.current
    if (g.pauseReason !== 'brightness') return
    g.paused = false; g.pauseReason = 'none'; g.darknessAdjusted = true; g.lastTimestamp = 0
    setPhase('playing')
    setUiMessage('밝기 올리셨죠? 어둠도 업그레이드했습니다~')
    animFrameRef.current = requestAnimationFrame(loop)
  }, [loop])

  const restartAfterError = useCallback(() => {
    setPhase('idle')
    endRunByKey('error59')
  }, [endRunByKey])

  // ─── Mouse / Touch ────────────────────────────────────

  const canvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    // object-fit: contain — compute actual rendered area
    const canvasAspect = WIDTH / HEIGHT
    const rectAspect = rect.width / rect.height
    let renderW: number, renderH: number, offsetX: number, offsetY: number
    if (rectAspect > canvasAspect) {
      renderH = rect.height
      renderW = rect.height * canvasAspect
      offsetX = (rect.width - renderW) / 2
      offsetY = 0
    } else {
      renderW = rect.width
      renderH = rect.width / canvasAspect
      offsetX = 0
      offsetY = (rect.height - renderH) / 2
    }
    gs.current.mouseX = ((clientX - rect.left - offsetX) / renderW) * WIDTH
    gs.current.mouseY = ((clientY - rect.top - offsetY) / renderH) * HEIGHT
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    canvasCoords(e.clientX, e.clientY)
  }, [canvasCoords])

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (!touch) return
    canvasCoords(touch.clientX, touch.clientY)
  }, [canvasCoords])

  // ─── Prevent mobile scroll/bounce on touch ────────────

  useEffect(() => {
    const prevent = (e: TouchEvent) => {
      if (phase === 'playing') e.preventDefault()
    }
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [phase])

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
  const isPlaying = phase === 'playing'

  // ─── Mascot system: (route × character × speech) random per session ───
  const MASCOT_SETS: Record<string, { chars: string[]; speeches: Record<string, string[]> }> = {
    normal:   { chars: ['🐹','🐰','🐱','🦊','🐶'], speeches: {
      '🐹': ['파이팅!','쉽죠?','에헤헤~','잘하네!','오?!','헐...','대박','ㄷㄷ','살려줘','미쳤다','ㅋㅋㅋ','진짜?!','거의다!','!!!'],
      '🐰': ['당근 가능!','당근이다!','깡총~','뛰어!','토끼라서 빠름','귀 접었다','풀 먹을 시간','도망쳐!','구멍 파야겠다','헉','당근 걸고','완전 찐','살았다?','와!'],
      '🐱': ['냥~','귀찮다','잠온다','핥핥','야옹','츤츤','관심없음','...뭐','놀아줘','싫은데','냐하하','대단하다냥','거의냥','퍼르릉'],
      '🦊': ['여우비!','콘콘','영리하게~','꾀가 많다','살금살금','여우짓','키키','엥?','속았지?','나 천재','완전 쿨','후훗','거의야!','캬~'],
      '🐶': ['멍!','꼬리살랑','간식줘','충성!','왈왈','킁킁','산책가자','멍멍이 화남','으르르','댕댕','헥헥','잘한다!','조금만!','왕!'],
    }},
    instant:  { chars: ['💀','👻','☠️','🪦','😵'], speeches: {
      '💀': ['ㅋ','빠이~','안녕~','RIP','ㅎㅎ','끝','바로 사망','ㅋㅋㅋㅋ','0초컷','하...','반갑다','어이없네','gg','와우'],
      '👻': ['부~','유령됐다','나도 죽음','같이 가자','무섭지?','호호호','저세상','천국행','급행열차','헤헤','슝~','안녕히~','편히쉬어','...'],
      '☠️': ['사망','끝장','해골해골','뼈만 남았다','아이고','합장','R.I.P.','묵념','고인...','사인: 실력','검시관 호출','즉사','부검 필요','ㅎ'],
      '🪦': ['여기 잠들다','추모','헌화','고인의 명복','짧은 생','0초 인생','비석 새김','안식','편안','불쌍','눈물','망자','합장','...'],
      '😵': ['엥?!','뭐야','어?','잠깐','방금 뭐','눈 깜빡했는데','아직 시작도','로딩 중인데','뇌 정지','에러','멈춰','뭔 일','이게 뭐','ㅋ'],
    }},
    hope:     { chars: ['🌈','🍀','⭐','🎈','🦋'], speeches: {
      '🌈': ['할만하다!','무지개다!','쉬운데?','꿀이다','이기겠다','자신감 UP','여유~','느긋','하하','이겼다!','에이 쉽네','음?','어?','아...'],
      '🍀': ['행운이다!','4잎이다!','럭키~','운 좋은 날','대박 예감','클로버!','찾았다!','풀밭','초록초록','평화','안전해','행복','엥?','잠깐?!'],
      '⭐': ['반짝!','별이다!','소원빌어','빛나는 나','스타!','지금이야','찬란','금별','예쁘다','완벽해','최고다','앗','잠깐','거짓말?!'],
      '🎈': ['둥둥~','풍선이다','날아가자','가볍다','기분 좋아','축제다!','파티!','히히','터지면 어쩌지','괜찮아','안 터져','아직 안전','음?','펑!'],
      '🦋': ['팔랑~','나비다','예쁘게','우아하게','꽃밭','봄이다','살랑살랑','가벼워','날개짓','자유','평화롭다','음?','어디가','잠깐!'],
    }},
    pattern:  { chars: ['🤖','🧠','🔬','📊','🎯'], speeches: {
      '🤖': ['분석중','패턴 발견','계산 완료','학습중','AI는 알고있다','데이터 수집','처리중...','이해했다','예측 가능','최적화','99%','에러?','재계산','버그?!'],
      '🧠': ['생각중','IQ 상승','뇌풀가동','패턴이다!','외웠다','기억력!','천재인가?','답 알았다','공부했다','분석!','아하!','잠깐','이상한데','뇌정지'],
      '🔬': ['관찰중','연구중','실험이다','가설 검증','데이터!','현미경','확대','발견!','논문감','증명 완료','유레카','이상치?','오류','폭발!'],
      '📊': ['그래프 UP','차트 분석','통계적으로','데이터!','상승세','추세선','예측모델','회귀분석','p<0.05','유의미','아웃라이어','분산?','이상?','급락!'],
      '🎯': ['정조준','명중!','과녁이다','집중!','정확해','센터!','불스아이','조준중','발사','빗나감없다','퍼펙트','엇?','빗나갔다','에?!'],
    }},
    growth:   { chars: ['🐣','🍄','🎃','🫧','🧸'], speeches: {
      '🐣': ['삐약!','작아서 괜찮아','삐약삐약','병아리다','조그맣다','귀엽지?','아직 작아','성장중','크는 중','좀 컸나?','좀 뚱뚱?','꽤 큰데','거대화','...살쪘다'],
      '🍄': ['버섯이다!','톡톡','자라는중','쑥쑥','키 크자','스머프?','포자!','균사체','독버섯?','팽이버섯','영지?','1UP?','거대버섯','우와큰데'],
      '🎃': ['호박이다!','씨앗','싹이 났다','자란다','호박꽃','덩굴','초록초록','노랗게','주황!','크다!','할로윈','잭오랜턴','거대호박','세계기록!'],
      '🫧': ['뽀글','작은 거품','보글보글','투명해','예쁘다','둥실','커진다','부풀어','더 커져','위험해','팽창','임계점','곧 터져','펑!'],
      '🧸': ['포근~','안아줘','작은 곰','인형이야','솜털','귀여워','곰돌이','허그','부드러워','커졌다','좀 큰데','뚱곰','거대곰','곰이다!'],
    }},
    reward:   { chars: ['🎁','🎰','💎','🏆','🃏'], speeches: {
      '🎁': ['선물이다!','뭘까~','열어봐!','두근두근','깜짝!','축하해!','당첨!','ㅋㅋ 속았지','가짜였음','에러 창','오류입니다','시스템 장애','복구 불가','ㅎㅎ'],
      '🎰': ['잭팟!','777','슬롯머신','당첨?','대박?','행운?','한 번 더','아깝다','거의!','꽝~','꽝꽝꽝','사기다','환불해줘','조작이다'],
      '💎': ['반짝!','보석이다','다이아몬드','부자될듯','광산','채굴!','캐럿','보물!','찾았다','가짜?','유리구슬','사기당함','환불!','큐빅이잖아'],
      '🏆': ['우승!','1등이다','트로피!','챔피언','MVP','금메달','영광!','시상대','수상소감','잠깐?','도금이다','벗겨짐','가품','100원짜리'],
      '🃏': ['조커다!','카드 한 장','마술!','타다~','트릭','속임수','눈속임','짜잔!','없었다','에이스?','꽝','사기꾼','ㅋ','조커는 나'],
    }},
    hudDrop:  { chars: ['🔩','⚙️','🪛','🔧','🛠️'], speeches: {
      '🔩': ['덜컹','나사 빠짐','조립불량','볼트 탈락','흔들린다','위험해','떨어진다!','UI 낙하','화면 해체','분해중','고장','수리불가','폐기','잔해'],
      '⚙️': ['기어 돌아감','돌아간다','삐걱','윤활유 필요','마모','부식','녹슬었다','끼익','멈출듯','과부하','고장남','뚝','분해','산산조각'],
      '🪛': ['수리중','드라이버','조이는 중','풀린다','빠진다','나사 어디','못 찾겠다','포기','수리불가','A/S 만료','보증기간?','환불','폐기','망함'],
      '🔧': ['렌치!','고치는 중','정비','점검중','이상없음','거짓말','있었음','경고등','빨간불','위험','대피해','탈출!','늦었다','...'],
      '🛠️': ['공구함','수리 시작','공사중','안전모!','통제구역','출입금지','무너진다','대피!','붕괴','위험지역','구조요청','119','헬프','SOS'],
    }},
    drift:    { chars: ['🌀','💨','🎐','🍃','🪁'], speeches: {
      '🌀': ['어지러워','빙글빙글','소용돌이','회전','돌아간다','멈춰줘','어질어질','빙빙','스핀','방향이?','어디로','왼쪽?오른쪽?','반대잖아','거꾸로!'],
      '💨': ['슈웅','바람이다','휘이익','날아간다','풍속 UP','돌풍','바람 세다','흔들려','위험해','날려감','붙잡아','잡아줘!','흩어져','안돼!'],
      '🎐': ['딸랑','풍경이다','소리 난다','바람 분다','흔들흔들','딸랑딸랑','방향 바뀜','어디서?','살랑살랑','세지는데','위험해','쨍그랑','깨졌다','산산조각'],
      '🍃': ['살랑','나뭇잎','흩날린다','풀잎','산들바람','가을?','떨어진다','바스락','굴러간다','어디로','길 잃었다','방향?','제멋대로','안녕~'],
      '🪁': ['날아~','연이다','줄 잡아','바람 타자','하늘높이','올라간다','방향 전환','줄 끊겼다','어디로','돌아와','제멋대로','컨트롤 불가','자유다','빠이~'],
    }},
    darkness: { chars: ['🌙','🦉','🕯️','⭐','🔦'], speeches: {
      '🌙': ['달빛~','밤이다','어둡다','괜찮아','적응된다','눈 떠봐','앞이?','깜깜','아무것도','손이?','발이?','여기 어디','살려줘','칠흑'],
      '🦉': ['부엉','야행성','밤눈 좋아','나는 보여','넌 못 보지','부엉부엉','어둠의 왕','야간 모드','암흑','눈 좋은데','고글 필요?','헉','앞이?','모르겠다'],
      '🕯️': ['촛불!','불 켜자','따뜻해','은은하게','꺼지면?','바람!','흔들려','점점 약해','잠깐만','꺼진다','안돼','깜빡','꺼졌다','캄캄'],
      '⭐': ['반짝!','별빛','예쁘다','밤하늘','빛나는','작은 빛','희망?','점점 희미','흐려진다','구름?','안 보여','어디?','사라졌다','암흑'],
      '🔦': ['켜짐!','손전등','밝다!','여기 보여','비추는 중','건전지?','점멸','흐려진다','약해진다','깜빡','로우배터리','1%','꺼진다','암전'],
    }},
    wall:     { chars: ['🧱','🏰','🛡️','⛏️','🚧'], speeches: {
      '🧱': ['벽이다!','안전한데?','여기 괜찮아','숨자','벽 뒤로','방어!','든든해','요새','안전지대','철벽','무적?','금 갔다','무너진다!','붕괴!'],
      '🏰': ['성이다!','수비!','철통방어','입성!','왕이다','안전!','견고해','난공불락','영원히?','금 갔다','무너진다','탈출해!','함락','폐허'],
      '🛡️': ['방패!','막는다','수비 UP','튼튼','가드!','완벽 방어','철벽!','무적이다','흠집?','금 갔다','깨진다!','방어력 0','무용지물','부서짐'],
      '⛏️': ['캐자!','곡괭이','채굴!','뚫어!','여기 파자','숨을 곳','지하로','땅굴!','안전?','무너진다','매몰!','대피!','탈출!','살려줘'],
      '🚧': ['공사중!','진입금지','안전구역','여기 안전','대피소','보호구역','바리케이드','방어선','유지중','균열?','위험!','철수!','무너진다','도망쳐!'],
    }},
    bigBullet:{ chars: ['🐋','🌋','☄️','🦕','🪐'], speeches: {
      '🐋': ['뿌우~','고래다!','거대해','바다의 왕','물보라!','잠수!','올라간다','크다...','더 크다','거대화','세상에','뭐야 저거','도망쳐!','살려줘!'],
      '🌋': ['우르르','화산이다','용암!','분화?','연기난다','뜨겁다','위험해','대피!','폭발?','도망쳐','으아아','분화!','용암류!','펑!'],
      '☄️': ['떨어진다!','유성이다','별똥별?','소원 빌어','예쁘다','크다','엄청 크다','저거 뭐야','맞으면?','피해!','안 피해짐','거대해','종말','멸망!'],
      '🦕': ['쿵쿵','공룡이다','브라키오','목이 길다','크다!','거대해','먹이?','도망쳐','풀 먹어','안 잡아먹지?','어?','쫓아온다','빠르다!','살려줘!'],
      '🪐': ['행성이다','토성?','고리 예쁘다','우주','저 멀리','다가온다','점점 크다','하늘을 덮어','거대해','세상에','불가능','우주급','종말','빅뱅!'],
    }},
    error59:  { chars: ['⏰','⌛','🕐','🔄','⏳'], speeches: {
      '⏰': ['째깍','시간이다','흘러간다','정상이야','29초','아직이야','기다려','조금만','거의','멈췄다?','왜?','고장?','이상한데','속았다!'],
      '⌛': ['모래시계','흘러흘러','반 왔다','모래가~','곧이야','기다려','인내심','참아','거의다','멈췄다?','뒤집혀?','에러?','고장','사기!'],
      '🕐': ['1시!','시간 간다','째각째각','바늘이~','돌아간다','정상','괜찮아','문제없어','아직이야','이상?','역회전?','뭐야','거꾸로!','시간 사기!'],
      '🔄': ['돌아간다','로딩중','처리중','기다려','버퍼링','곧 끝나','인내','조금만','거의','멈췄다','끝없다','무한루프','에러','속았지ㅋ'],
      '⏳': ['기다려','시간의 강','흘러감','인내심','참을 인','수양중','명상','평온','zen','멈췄다?','거짓','속임수','가짜','ㅋㅋㅋ'],
    }},
  }

  // Pick a random mascot set based on route, stable per game
  const mascotRef = useRef<Record<string, { bar: string; hud1: string; hud2: string; hud3: string }>>({})

  const getMascots = useCallback((route: Route) => {
    if (mascotRef.current[route]) return mascotRef.current[route]
    const set = MASCOT_SETS[route] || MASCOT_SETS.normal
    const chars = set.chars
    const pick = () => chars[Math.floor(Math.random() * chars.length)]
    // Ensure all 4 positions get different characters
    const picks: string[] = []
    for (let i = 0; i < 4; i++) {
      const available = chars.filter(c => !picks.includes(c))
      const chosen = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : pick()
      picks.push(chosen)
    }
    mascotRef.current[route] = { bar: picks[0], hud1: picks[1], hud2: picks[2], hud3: picks[3] }
    return mascotRef.current[route]
  }, [])

  const getSpeech = useCallback((route: Route, char: string, timeVal: number, totalSteps: number) => {
    const set = MASCOT_SETS[route] || MASCOT_SETS.normal
    const speeches = set.speeches[char] || set.speeches[set.chars[0]] || ['...']
    const idx = Math.min(Math.floor((timeVal / totalSteps) * speeches.length), speeches.length - 1)
    return speeches[idx]
  }, [])

  const timeNum = parseFloat(uiTime) || 0
  const mascots = getMascots(uiRoute)
  const barSpeech = getSpeech(uiRoute, mascots.bar, timeNum, target)
  const hud1Speech = getSpeech(uiRoute, mascots.hud1, timeNum, target)
  const hud2Speech = getSpeech(uiRoute, mascots.hud2, timeNum, target)
  const hud3Speech = getSpeech(uiRoute, mascots.hud3, timeNum, target)

  // ─── Render ────────────────────────────────────────────

  return (
    <div className={s.dodgeRoot}>
      <div className={s.canvasWrap}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onMouseMove={onMouseMove} onTouchMove={onTouchMove} />

        {/* Top HUD - only during play */}
        {isPlaying && (
          <div className={s.topHud} style={{ opacity: uiHudOpacity }}>
            <div className={s.hudGroup}>
              <div className={s.hudPill}>{uiHudHint}</div>
            </div>
            <div className={s.hudGroup}>
              <div className={s.hudPill}>
                <span className={s.hudMascot}>
                  <span className={s.hudSpeech}>{hud1Speech}</span>
                  {mascots.hud1}
                </span>
                LV {uiLevel}
              </div>
              <div className={s.hudPill}>
                <span className={s.hudMascot}>
                  <span className={s.hudSpeech}>{hud2Speech}</span>
                  {mascots.hud2}
                </span>
                도전 {uiAttempts}회
              </div>
              <div className={s.hudPill}>
                <span className={s.hudMascot}>
                  <span className={s.hudSpeech}>{hud3Speech}</span>
                  {mascots.hud3}
                </span>
                기록 {getCollectedCount(collected)}/{TOTAL_VISIBLE_COLLECTION}
              </div>
            </div>
          </div>
        )}

        {/* Bottom progress bar - only during play */}
        {isPlaying && (
          <div className={s.bottomBar}>
            <div className={s.progressRow}>
              <span className={s.progressTime}>{uiTime}</span>
              <div className={s.barCharWrap}>
                <span className={s.barChar} style={{ left: `calc(${uiProgress}% - 9px)` }}>
                  <span className={s.barSpeech}>{barSpeech}</span>
                  {mascots.bar}
                </span>
                <div className={s.bar}>
                  <div className={s.barFill} style={{ width: uiProgress + '%' }} />
                </div>
              </div>
              <span className={s.progressTime}>{target.toFixed(0)}s</span>
            </div>
          </div>
        )}

        {/* Start Overlay */}
        {phase === 'idle' && (
          <div className={s.overlay}>
            <div className={s.overlayCard}>
              <div className={s.heroTitle}>ZERO TRACE</div>
              <p className={s.heroSub}>
                60초만 살아남으면 됩니다. 간단하죠?<br />
                (개발자는 웃고 있습니다)
              </p>
              <div className={s.nameRow}>
                <input
                  className={s.nameInput}
                  type="text"
                  placeholder="닉네임"
                  maxLength={20}
                  value={playerName}
                  onChange={(e) => { setPlayerName(e.target.value); localStorage.setItem(NAME_STORAGE_KEY, e.target.value) }}
                />
                <button
                  className={s.rerollBtn}
                  onClick={() => { generateUniqueName().then((n) => { setPlayerName(n); localStorage.setItem(NAME_STORAGE_KEY, n) }) }}
                  title="랜덤 닉네임"
                >&#x1F3B2;</button>
              </div>
              <div className={s.heroActions}>
                <button className={`${s.btn} ${s.primaryBtn}`} onClick={startGame}>죽으러 가기</button>
                <button className={`${s.btn} ${s.secondaryBtn}`} onClick={openCollection}>사망 도감</button>
                <button className={`${s.btn} ${s.secondaryBtn}`} onClick={() => { fetchLeaderboard(); setPhase('leaderboard') }}>랭킹</button>
              </div>
            </div>
          </div>
        )}

        {/* Result Overlay */}
        {phase === 'result' && resultInfo && (
          <div className={s.overlay}>
            <div className={s.overlayCard}>
              <div className={s.heroTitle} style={{ fontSize: 32 }}>{resultInfo.title}</div>
              <p className={s.heroSub}>{resultInfo.description}</p>
              <p className={s.footerNote}>{resultInfo.footer}</p>
              <div className={s.heroActions}>
                <button className={`${s.btn} ${s.primaryBtn}`} onClick={startGame}>또 죽으러 가기</button>
                <button className={`${s.btn} ${s.secondaryBtn}`} onClick={openCollection}>사망 도감</button>
                <button className={`${s.btn} ${s.secondaryBtn}`} onClick={() => { fetchLeaderboard(); setPhase('leaderboard') }}>랭킹</button>
              </div>
            </div>
          </div>
        )}

        {/* Error Modal */}
        {phase === 'error' && (
          <div className={s.overlay}>
            <div className={s.overlayCard}>
              <div className={s.errorTitle}>앗! 시간이 고장났어요</div>
              <p className={s.heroSub}>
                시간이 29초에서 멈춘 건 버그가 아닙니다.<br />
                만우절 기념 특별 기능이에요. 감사하세요.
              </p>
              <div className={s.heroActions}>
                <button className={`${s.btn} ${s.primaryBtn}`} onClick={restartAfterError}>억울하지만 확인</button>
              </div>
            </div>
          </div>
        )}

        {/* Brightness Modal */}
        {phase === 'brightness' && (
          <div className={s.overlay}>
            <div className={`${s.overlayCard} ${s.brightnessCard}`}>
              <div className={s.heroTitle} style={{ marginBottom: 12 }}>안 보이시죠?</div>
              <p className={s.heroSub}>
                화면이 어두운 건 당신 폰 문제입니다.<br />
                밝기를 올리면 해결됩니다. (해결 안 됨)
              </p>
              <div className={s.brightnessPreview}>MAX BRIGHTNESS</div>
              <div className={s.heroActions}>
                <button className={`${s.btn} ${s.primaryBtn}`} onClick={resumeAfterBrightness}>속는 셈 치고 밝기 올리기</button>
              </div>
            </div>
          </div>
        )}

        {/* Roulette Modal */}
        {phase === 'roulette' && (
          <div className={s.overlay}>
            <div className={s.overlayCard} style={{ maxWidth: 440 }}>
              {roulettePhase === 'spinning' && (
                <>
                  <div className={s.heroTitle} style={{ fontSize: 28 }}>🎉 60초 생존 축하! 🎉</div>
                  <p className={s.heroSub}>특별 보상 룰렛을 돌려드립니다!</p>
                  <div className={s.rouletteWheel}>
                    <div className={s.roulettePointer}>▼</div>
                    <div className={s.rouletteDisc} style={{ transform: `rotate(${rouletteAngle}deg)` }}>
                      {FAKE_PRIZES.map((p, i) => (
                        <div
                          key={i}
                          className={s.rouletteSlice}
                          style={{ transform: `rotate(${(i / FAKE_PRIZES.length) * 360}deg)` }}
                        >
                          <span className={s.rouletteEmoji}>{p.emoji}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className={s.footerNote}>두근두근...</p>
                </>
              )}
              {roulettePhase === 'result' && (
                <>
                  <div className={s.heroTitle} style={{ fontSize: 24 }}>🎊 당첨! 🎊</div>
                  <div className={s.prizeCard}>
                    <div className={s.prizeEmoji}>{FAKE_PRIZES[roulettePrize].emoji}</div>
                    <div className={s.prizeName}>{FAKE_PRIZES[roulettePrize].name}</div>
                    <div className={s.prizeDesc}>{FAKE_PRIZES[roulettePrize].desc}</div>
                    <div className={s.prizeCode}>{FAKE_PRIZES[roulettePrize].code}</div>
                    <div className={s.prizeBarcode}>
                      {'▍▏▎▍▌▏▍▎▏▌▍▏▎▍▌▏▍▎▏▌▍▏▎▍▌▏▍▎▏▌'}
                    </div>
                    <div className={s.prizeExpiry}>유효기간: 2026.04.01 ~ 2026.04.01</div>
                  </div>
                  <div className={s.heroActions}>
                    <button className={`${s.btn} ${s.primaryBtn}`} onClick={() => setRoulettePhase('reveal')}>쿠폰 사용하기</button>
                  </div>
                </>
              )}
              {roulettePhase === 'reveal' && (
                <>
                  <div className={s.heroTitle} style={{ fontSize: 32 }}>만우절 🤡</div>
                  <p className={s.heroSub}>
                    진짜로 기프티콘이 나올 줄 알았나요?<br />
                    60초를 버텨서 대단하긴 한데...<br />
                    상품은 없습니다. 축하합니다!
                  </p>
                  <p className={s.footerNote}>
                    유효기간 보셨나요? 4월 1일 ~ 4월 1일 ㅋㅋ
                  </p>
                  <div className={s.heroActions}>
                    <button className={`${s.btn} ${s.primaryBtn}`} onClick={startGame}>분노의 재도전</button>
                    <button className={`${s.btn} ${s.secondaryBtn}`} onClick={() => setPhase('idle')}>포기하기</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collection Modal */}
      {phase === 'collection' && (
        <div className={s.modal} onClick={(e) => { if (e.target === e.currentTarget) closeCollection() }}>
          <div className={`${s.modalCard} ${s.collectionModalCard}`}>
            <h2 className={s.title} style={{ marginBottom: 8 }}>사망 도감</h2>
            <p className={s.sub}>다양한 방법으로 죽어보세요. 수집 욕구를 자극합니다.</p>
            <div className={s.collectionGrid}>
              {COLLECTION_ORDER.map((key) => {
                const data = ENDINGS[key]
                const unlocked = collected.includes(key)
                const name = unlocked ? data.name : key === 'fakeFinal' ? data.name : '???'
                const description = unlocked ? data.description : key === 'fakeFinal' ? data.description : '아직 이 방법으론 안 죽어봤네요.'
                const stateText = unlocked ? '사망 확인' : key === 'fakeFinal' ? '???' : '미경험'
                return (
                  <div key={key} className={`${s.endCard} ${unlocked ? s.endCardUnlocked : s.endCardLocked}`}>
                    <div className={s.endId}>{data.id}</div>
                    <div className={s.endState}>{stateText}</div>
                    <div className={s.endName}>{name}</div>
                    <div className={s.endDesc}>{description}</div>
                  </div>
                )
              })}
            </div>
            <div className={s.heroActions}>
              <button className={`${s.btn} ${s.primaryBtn}`} onClick={closeCollection}>닫기</button>
              <button className={`${s.btn} ${s.dangerBtn}`} onClick={() => { resetCollection(); closeCollection() }}>초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {phase === 'leaderboard' && (
        <div className={s.modal} onClick={(e) => { if (e.target === e.currentTarget) setPhase(resultInfo ? 'result' : 'idle') }}>
          <div className={`${s.modalCard} ${s.collectionModalCard}`}>
            <h2 className={s.title} style={{ marginBottom: 8 }}>생존 랭킹</h2>
            <p className={s.sub}>오래 살아남은 순서입니다. 부러우면 지는 겁니다.</p>
            <div className={s.leaderboardTable}>
              <div className={s.lbHeader}>
                <span className={s.lbRank}>#</span>
                <span className={s.lbName}>이름</span>
                <span className={s.lbTime}>최고 생존</span>
              </div>
              {leaderboard.length === 0 && (
                <div className={s.lbEmpty}>아직 아무도 안 죽었습니다. (거짓말)</div>
              )}
              {leaderboard.map((entry, i) => (
                <div key={i} className={`${s.lbRow} ${i < 3 ? s.lbTop3 : ''}`}>
                  <span className={s.lbRank}>{i + 1}</span>
                  <span className={s.lbName}>{entry.name}</span>
                  <span className={s.lbTime}>{Number(entry.survival_time).toFixed(2)}s</span>
                </div>
              ))}
            </div>
            <div className={s.heroActions}>
              <button className={`${s.btn} ${s.primaryBtn}`} onClick={() => setPhase(resultInfo ? 'result' : 'idle')}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
