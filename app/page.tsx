'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ==================== TEST HOOK ====================
// Tests can inject config via window.__GAME_CONFIG__ before page load
declare global {
  interface Window {
    __GAME_CONFIG__?: {
      version?: number
      seed?: number
      noSuddenReset?: boolean
      tooGoodTime?: number   // override 50s default for fast testing
      noObstacles?: boolean  // disable dodge obstacles for non-dodge tests
    }
  }
}

// ==================== TYPES ====================

type Phase = 'intro' | 'playing' | 'ending' | 'collection'
type GameVersion = 1 | 2 | 3 | 4 | 5
type EndingId =
  | 'timer_glitch'
  | 'reverse'
  | 'too_good'
  | 'blackout'
  | 'shield_boom'
  | 'item_trap'
  | 'system_error'
  | 'update_required'
  | 'virus_found'
  | 'sudden_reset'
  | 'dodge_fail'

interface EndingDef {
  id: EndingId
  title: string
  desc: string
  emoji: string
  msg: string[]
  rarity: 'common' | 'rare' | 'legendary'
  color: string
}

interface GameItem {
  id: string
  type: 'shield' | 'powerup'
  x: number
  y: number
  exploding: boolean
}

interface DodgeObstacle {
  id: number
  y: number      // % from top (top edge of bar)
  gapX: number   // % from left where gap starts
  gapW: number   // % width of gap
  speed: number  // % per 100ms tick
}

// ==================== DATA ====================

const ENDINGS: Record<EndingId, EndingDef> = {
  timer_glitch: {
    id: 'timer_glitch',
    title: '타임 오류',
    desc: '59초에서 멈춰버렸습니다',
    emoji: '🔢',
    msg: ['9... 99... 999... 9999...', '숫자가 이상합니다.', '시간 오류가 발생했습니다. 게임을 종료합니다.'],
    rarity: 'common',
    color: '#f59e0b',
  },
  reverse: {
    id: 'reverse',
    title: '역주행',
    desc: '너무 잘해서 시간이 거꾸로 흘렀습니다',
    emoji: '⏪',
    msg: ['58... 57... 56...', '너무 잘 하셔서 시간이 당황했습니다.', '0초가 되면 어쩌시려고요.'],
    rarity: 'common',
    color: '#3b82f6',
  },
  too_good: {
    id: 'too_good',
    title: '너무 잘함',
    desc: '실력이 너무 좋아서 게임이 항복했습니다',
    emoji: '🏆',
    msg: [
      '축하합니다!',
      '너무 잘 하셔서 깰 뻔 했습니다.',
      '이런 실력자는 처음 봤습니다.',
      '게임을 종료합니다. (당신이 문제입니다)',
    ],
    rarity: 'rare',
    color: '#a855f7',
  },
  blackout: {
    id: 'blackout',
    title: '정전',
    desc: '갑자기 화면이 꺼졌습니다',
    emoji: '🌑',
    msg: ['...', '(무음)', '(암전)'],
    rarity: 'common',
    color: '#6b7280',
  },
  shield_boom: {
    id: 'shield_boom',
    title: '방패 폭발',
    desc: '방패를 믿었는데 폭발했습니다',
    emoji: '🛡️',
    msg: ['방패를 클릭하셨군요.', 'BOOM 💥', '믿는 방패에 발등 찍힌다는 말이 있죠.'],
    rarity: 'rare',
    color: '#ef4444',
  },
  item_trap: {
    id: 'item_trap',
    title: '아이템 함정',
    desc: '빛나는 것이 다 좋은 것은 아닙니다',
    emoji: '💣',
    msg: ['아이템을 먹었습니다.', '...', '그건 폭탄이었습니다. 💥'],
    rarity: 'common',
    color: '#f97316',
  },
  system_error: {
    id: 'system_error',
    title: '시스템 오류',
    desc: '치명적인 오류가 발생했습니다',
    emoji: '💀',
    msg: ['FATAL: 0x0000DEAD', '오류 코드를 기억해두세요.', '(기억해도 의미 없음)'],
    rarity: 'rare',
    color: '#dc2626',
  },
  update_required: {
    id: 'update_required',
    title: '업데이트 필요',
    desc: '이 버전은 지원이 종료되었습니다',
    emoji: '🔄',
    msg: ['버전 1.0이 지원 종료되었습니다.', '2.0으로 업데이트하면 클리어 가능?', '(가능하지 않습니다)'],
    rarity: 'common',
    color: '#0ea5e9',
  },
  virus_found: {
    id: 'virus_found',
    title: '바이러스 발견',
    desc: '위험한 바이러스가 탐지되었습니다',
    emoji: '🦠',
    msg: ['[경고] 바이러스 발견!', '위험도: 매우 높음', '즉시 게임을 종료하십시오.'],
    rarity: 'rare',
    color: '#16a34a',
  },
  sudden_reset: {
    id: 'sudden_reset',
    title: '갑자기 재시작',
    desc: '이유 없이 처음으로 돌아갔습니다',
    emoji: '🔃',
    msg: ['.', '..', '...', '(무한 로딩 중)'],
    rarity: 'legendary',
    color: '#c026d3',
  },
  dodge_fail: {
    id: 'dodge_fail',
    title: '피격',
    desc: '막대를 피하지 못했습니다',
    emoji: '💥',
    msg: ['쾅! 💥', '거기 있으면 어떡해요.', '조금만 더 빨리 움직이지...'],
    rarity: 'common',
    color: '#ef4444',
  },
}

const ALL_ENDING_IDS = Object.keys(ENDINGS) as EndingId[]

const RARITY_LABEL: Record<string, string> = {
  common: '일반',
  rare: '희귀',
  legendary: '전설',
}

const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af',
  rare: '#60a5fa',
  legendary: '#f59e0b',
}

const RARITY_BG: Record<string, string> = {
  common: 'rgba(156,163,175,0.08)',
  rare: 'rgba(96,165,250,0.08)',
  legendary: 'rgba(245,158,11,0.12)',
}

const VERSION_INFO: Record<GameVersion, { name: string; emoji: string; hint: string }> = {
  1: { name: '기본 챌린지', emoji: '⏱️', hint: '막대를 피해 60초를 채워보세요' },
  2: { name: '역주행 챌린지', emoji: '⏪', hint: '피하다 보면 시간이 이상해집니다...' },
  3: { name: '암흑 챌린지', emoji: '🌑', hint: '피하다 보면 화면이 점점 어두워집니다' },
  4: { name: '아이템 챌린지', emoji: '🎁', hint: '피하다 보면 아이템이 나타납니다. 좋은 건지...' },
  5: { name: '에러 챌린지', emoji: '⚠️', hint: '피하다 보면 시스템이 불안정해집니다' },
}

const ADJECTIVES = [
  '용감한', '겁없는', '수줍은', '무적의', '졸린', '배고픈', '행복한', '슬픈',
  '화난', '엉뚱한', '진지한', '당당한', '귀여운', '현명한', '뚱뚱한', '냉정한',
]
const NOUNS = [
  '감자', '고양이', '도전자', '용사', '전사', '마법사', '탐험가', '수집가',
  '오리', '펭귄', '토끼', '곰', '늑대', '여우', '물고기', '고슴도치',
]

function randomNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 9000 + 1000)
  return `${a} ${n} #${num}`
}

// ==================== MAIN COMPONENT ====================

export default function Game() {
  const [phase, setPhase] = useState<Phase>('intro')
  // Initialize empty to avoid SSR/client hydration mismatch (Math.random differs)
  const [nickname, setNickname] = useState('')
  useEffect(() => { setNickname(randomNickname()) }, [])
  const [collectedEndings, setCollectedEndings] = useState<Set<EndingId>>(new Set())
  const [currentEnding, setCurrentEnding] = useState<EndingId | null>(null)

  // Playing state
  const [version, setVersion] = useState<GameVersion>(1)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [glitchText, setGlitchText] = useState<string | null>(null)
  const [darkLevel, setDarkLevel] = useState(0)
  const [isReversing, setIsReversing] = useState(false)
  const [items, setItems] = useState<GameItem[]>([])
  const [errorModal, setErrorModal] = useState<'system' | 'update' | 'virus' | null>(null)
  const [shaking, setShaking] = useState(false)
  const [tooGoodPopup, setTooGoodPopup] = useState(false)

  // Dodge mechanic state
  const [playerX, setPlayerX] = useState(50)
  const [dodgeObstacles, setDodgeObstacles] = useState<DodgeObstacle[]>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const glitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Dodge refs (avoid stale closures in setInterval)
  const playerXRef = useRef(50)
  const dodgeObstaclesRef = useRef<DodgeObstacle[]>([])
  const nextObsIdRef = useRef(0)
  const nextSpawnAtRef = useRef(0)

  // Use refs for mutable game state to avoid stale closures
  const gameState = useRef({
    active: false,
    endingTriggered: false,
    realTime: 0,
    displayTime: 0,
    reversing: false,
    reverseFrom: 0,
    darkening: false,
    darkLevel: 0,
    firedEvents: new Set<string>(),
  })

  const stopTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (glitchTimerRef.current) { clearInterval(glitchTimerRef.current); glitchTimerRef.current = null }
    gameState.current.active = false
  }, [])

  const addEnding = useCallback((id: EndingId) => {
    setCollectedEndings(prev => new Set([...prev, id]))
    setCurrentEnding(id)
  }, [])

  const triggerEnding = useCallback((id: EndingId, delay = 1200) => {
    const g = gameState.current
    if (g.endingTriggered) return
    g.endingTriggered = true
    stopTimers()
    addEnding(id)
    setTimeout(() => setPhase('ending'), delay)
  }, [stopTimers, addEnding])

  const doShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => setShaking(false), 650)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(3, Math.min(97, ((e.clientX - rect.left) / rect.width) * 100))
    playerXRef.current = x
    setPlayerX(x)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(3, Math.min(97, ((e.touches[0].clientX - rect.left) / rect.width) * 100))
    playerXRef.current = x
    setPlayerX(x)
  }, [])

  const startGame = useCallback(() => {
    stopTimers()

    const cfg = typeof window !== 'undefined' ? window.__GAME_CONFIG__ : undefined
    const v = (cfg?.version ?? Math.floor(Math.random() * 5) + 1) as GameVersion
    const seed = cfg?.seed ?? Math.floor(Math.random() * 100)
    const hasSuddenReset = cfg?.noSuddenReset ? false : Math.random() < 0.07
    const suddenResetTime = hasSuddenReset ? 6 + Math.random() * 25 : 9999

    gameState.current = {
      active: true,
      endingTriggered: false,
      realTime: 0,
      displayTime: 0,
      reversing: false,
      reverseFrom: 0,
      darkening: false,
      darkLevel: 0,
      firedEvents: new Set(),
    }

    // Reset UI state
    setPhase('playing')
    setVersion(v)
    setDisplaySeconds(0)
    setGlitchText(null)
    setDarkLevel(0)
    setIsReversing(false)
    setItems([])
    setErrorModal(null)
    setShaking(false)
    setTooGoodPopup(false)
    setCurrentEnding(null)

    // Reset dodge state
    playerXRef.current = 50
    setPlayerX(50)
    dodgeObstaclesRef.current = []
    setDodgeObstacles([])
    nextObsIdRef.current = 0
    nextSpawnAtRef.current = 1.5  // first obstacle spawns at t=1.5s

    const g = gameState.current

    timerRef.current = setInterval(() => {
      if (!g.active) return

      g.realTime += 0.1
      const t = g.realTime

      // Rare: sudden reset
      if (!g.firedEvents.has('sudden_reset') && t >= suddenResetTime) {
        g.firedEvents.add('sudden_reset')
        triggerEnding('sudden_reset', 1800)
        return
      }

      // Update displayed time
      if (g.reversing) {
        g.reverseFrom = Math.max(0, g.reverseFrom - 0.1)
        setDisplaySeconds(Math.floor(g.reverseFrom))
        setIsReversing(true)
      } else {
        g.displayTime = Math.min(g.displayTime + 0.1, 59.9)
        setDisplaySeconds(Math.floor(g.displayTime))
      }

      // Darkening effect
      if (g.darkening) {
        g.darkLevel = Math.min(1, g.darkLevel + 0.006)
        setDarkLevel(g.darkLevel)
      }

      // Version-specific events
      switch (v) {
        case 1: {
          // Timer glitch at 58s
          if (!g.firedEvents.has('glitch') && t >= 58) {
            g.firedEvents.add('glitch')
            g.active = false
            clearInterval(timerRef.current!)
            timerRef.current = null

            let seq = '9'
            setGlitchText('9')
            glitchTimerRef.current = setInterval(() => {
              seq = seq + '9'
              setGlitchText(seq)
              if (seq.length >= 5) {
                clearInterval(glitchTimerRef.current!)
                glitchTimerRef.current = null
                triggerEnding('timer_glitch', 900)
              }
            }, 450)
          }
          break
        }

        case 2: {
          // Reverse mode
          const reverseStart = 14 + (seed % 10)
          if (!g.firedEvents.has('reverse_start') && t >= reverseStart) {
            g.firedEvents.add('reverse_start')
            g.reversing = true
            g.reverseFrom = g.displayTime
          }
          if (g.reversing && !g.firedEvents.has('reverse_end')) {
            if (g.reverseFrom <= 0 || t >= reverseStart + 22) {
              g.firedEvents.add('reverse_end')
              triggerEnding('reverse')
            }
          }
          break
        }

        case 3: {
          // Blackout
          const darkenStart = 18 + (seed % 8)
          if (!g.firedEvents.has('darken') && t >= darkenStart) {
            g.firedEvents.add('darken')
            g.darkening = true
          }
          if (!g.firedEvents.has('blackout') && g.darkLevel >= 0.97) {
            g.firedEvents.add('blackout')
            triggerEnding('blackout', 400)
          }
          break
        }

        case 4: {
          // Items
          const powerupTime = 14 + (seed % 5)
          const shieldTime = 28 + (seed % 7)
          const tooGoodTime = cfg?.tooGoodTime ?? 50

          if (!g.firedEvents.has('powerup') && t >= powerupTime) {
            g.firedEvents.add('powerup')
            setItems(prev => [...prev, {
              id: 'powerup',
              type: 'powerup',
              x: 15 + Math.random() * 70,
              y: 15 + Math.random() * 45,
              exploding: false,
            }])
          }
          if (!g.firedEvents.has('shield') && t >= shieldTime) {
            g.firedEvents.add('shield')
            setItems(prev => [...prev, {
              id: 'shield',
              type: 'shield',
              x: 15 + Math.random() * 70,
              y: 15 + Math.random() * 45,
              exploding: false,
            }])
          }
          if (!g.firedEvents.has('too_good') && t >= tooGoodTime) {
            g.firedEvents.add('too_good')
            g.active = false
            clearInterval(timerRef.current!)
            timerRef.current = null
            setTooGoodPopup(true)
          }
          break
        }

        case 5: {
          // Error mode
          const errorTime = 10 + (seed % 18)
          if (!g.firedEvents.has('error') && t >= errorTime) {
            g.firedEvents.add('error')
            g.active = false
            clearInterval(timerRef.current!)
            timerRef.current = null
            const roll = seed % 3
            if (roll === 0) setErrorModal('system')
            else if (roll === 1) setErrorModal('update')
            else setErrorModal('virus')
          }
          break
        }
      }

      // ---- DODGE MECHANIC (all versions) ----
      if (!cfg?.noObstacles && g.active && !g.endingTriggered) {
        // Spawn new obstacle when timer reaches nextSpawnAt
        if (t >= nextSpawnAtRef.current) {
          // Gap shrinks from 42% → 24% as time goes on; interval from 3s → 1s
          const gapW = Math.max(24, 42 - Math.floor(t / 8) * 2)
          const gapX = 3 + Math.random() * (94 - gapW)
          const speed = 1.2 + t * 0.025  // % per tick, increases over time
          const interval = Math.max(1.0, 3.0 - t * 0.03)
          nextSpawnAtRef.current = t + interval
          dodgeObstaclesRef.current = [
            ...dodgeObstaclesRef.current,
            { id: nextObsIdRef.current++, y: -8, gapX, gapW, speed },
          ]
        }

        // Move obstacles downward, remove off-screen ones
        dodgeObstaclesRef.current = dodgeObstaclesRef.current
          .map(obs => ({ ...obs, y: obs.y + obs.speed }))
          .filter(obs => obs.y < 110)

        // Collision detection (player rect vs each bar segment)
        const PX = playerXRef.current
        const PW = 5    // player half-width %
        const PY = 78   // player top %
        const PH = 8    // player height %
        const BAR_H = 5 // bar height %
        for (const obs of dodgeObstaclesRef.current) {
          const yOverlap = obs.y + BAR_H > PY && obs.y < PY + PH
          if (yOverlap) {
            const pL = PX - PW / 2
            const pR = PX + PW / 2
            // Player is safe only if fully within the gap
            if (pL < obs.gapX || pR > obs.gapX + obs.gapW) {
              triggerEnding('dodge_fail', 200)
              break
            }
          }
        }

        setDodgeObstacles([...dodgeObstaclesRef.current])
      }
    }, 100)
  }, [stopTimers, triggerEnding])

  const handleItemClick = useCallback((item: GameItem) => {
    const g = gameState.current
    if (g.endingTriggered || item.exploding) return
    doShake()
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, exploding: true } : i))
    setTimeout(() => {
      triggerEnding(item.type === 'shield' ? 'shield_boom' : 'item_trap', 600)
    }, 400)
  }, [doShake, triggerEnding])

  const handleTooGoodRetry = useCallback(() => {
    addEnding('too_good')
    setTooGoodPopup(false)
    setPhase('ending')
  }, [addEnding])

  const handleErrorConfirm = useCallback((id: EndingId) => {
    setErrorModal(null)
    addEnding(id)
    setPhase('ending')
  }, [addEnding])

  useEffect(() => {
    return () => stopTimers()
  }, [stopTimers])

  // ==================== RENDER ====================

  if (phase === 'collection') {
    return (
      <CollectionView
        collected={collectedEndings}
        onBack={() => setPhase('intro')}
      />
    )
  }

  if (phase === 'ending' && currentEnding) {
    return (
      <EndingView
        ending={ENDINGS[currentEnding]}
        collected={collectedEndings}
        onRetry={startGame}
        onCollection={() => setPhase('collection')}
      />
    )
  }

  if (phase === 'intro') {
    return (
      <IntroView
        nickname={nickname}
        collected={collectedEndings}
        onStart={startGame}
        onCollection={() => setPhase('collection')}
      />
    )
  }

  // ---- PLAYING PHASE ----

  const progress = Math.min(1, displaySeconds / 60)
  const vInfo = VERSION_INFO[version]

  return (
    <div
      className={`min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden select-none${shaking ? ' shake' : ''}`}
    >
      {/* Dark overlay for blackout */}
      {darkLevel > 0 && (
        <div
          className="dark-overlay"
          style={{ opacity: darkLevel }}
        />
      )}

      {/* Top bar */}
      <div className="flex justify-between items-center px-5 pt-5 pb-2 text-xs text-gray-600 z-10">
        <span>{vInfo.emoji} {vInfo.name}</span>
        <span>{nickname}</span>
      </div>

      {/* Main game area */}
      <div
        className="flex-1 relative flex items-center justify-center z-10 overflow-hidden cursor-none"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'none' }}
      >
        {/* Dodge obstacles — two bar segments with a gap */}
        {dodgeObstacles.map(obs => (
          <div key={obs.id}>
            {obs.gapX > 0 && (
              <div
                className="absolute dodge-bar"
                style={{ left: 0, width: `${obs.gapX}%`, top: `${obs.y}%` }}
              />
            )}
            {obs.gapX + obs.gapW < 100 && (
              <div
                className="absolute dodge-bar"
                style={{ left: `${obs.gapX + obs.gapW}%`, width: `${100 - obs.gapX - obs.gapW}%`, top: `${obs.y}%` }}
              />
            )}
          </div>
        ))}

        {/* Player character */}
        <div
          className="absolute pointer-events-none z-20"
          style={{ left: `${playerX}%`, top: '78%', transform: 'translate(-50%, -50%)' }}
        >
          <span className="text-3xl select-none">🚀</span>
        </div>

        {/* Items */}
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={`absolute cursor-pointer ${item.exploding ? 'explode' : 'float-item'}`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {item.type === 'shield' ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-6xl item-shield-glow hover:scale-110 transition-transform">🛡️</span>
                <span className="text-xs text-blue-300 font-bold bg-blue-900/50 px-2 py-0.5 rounded-full">
                  클릭!
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-6xl item-power-glow hover:scale-110 transition-transform">⭐</span>
                <span className="text-xs text-yellow-300 font-bold bg-yellow-900/50 px-2 py-0.5 rounded-full">
                  아이템!
                </span>
              </div>
            )}
          </button>
        ))}

        {/* Hint when nothing is happening */}
        {!glitchText && items.length === 0 && !tooGoodPopup && (
          <div className="text-center space-y-2 pointer-events-none">
            {isReversing ? (
              <p className="text-blue-400 text-lg font-bold reverse-pulse">⏪ 역주행 중...</p>
            ) : (
              <p className="text-gray-800 text-sm">{vInfo.hint}</p>
            )}
          </div>
        )}

        {/* Too Good popup */}
        {tooGoodPopup && (
          <div className="fade-in-up text-center space-y-4 px-8">
            <div className="text-5xl">🏆</div>
            <h2 className="text-2xl font-black text-white">축하합니다!</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              너무 잘 하셔서 깰 뻔 했습니다.<br />
              이런 실력으로는 게임이 너무 쉬울 것 같아<br />
              강제로 종료합니다.
            </p>
            <button
              onClick={handleTooGoodRetry}
              className="mt-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold px-8 py-3 rounded-xl transition-all text-sm"
            >
              다시 도전하기
            </button>
          </div>
        )}
      </div>

      {/* Timer section */}
      <div className="px-6 pb-8 space-y-3 z-10">
        {/* Time number */}
        <div className="flex items-end justify-center gap-2">
          {glitchText ? (
            <span className="text-7xl font-mono font-black text-yellow-300 glitch-number tracking-wider">
              {glitchText}
            </span>
          ) : (
            <span
              className={`text-7xl font-mono font-black transition-colors ${
                isReversing ? 'text-blue-400' : 'text-white'
              }`}
            >
              {displaySeconds}
            </span>
          )}
          {!glitchText && (
            <span className="text-gray-700 text-2xl mb-2">/ 60</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-800/80 rounded-full h-5 overflow-hidden border border-gray-700/50">
          <div
            className={`h-full rounded-full transition-all duration-100 ${
              isReversing
                ? 'bg-gradient-to-r from-blue-700 to-blue-400'
                : glitchText
                  ? 'bg-yellow-400'
                  : 'bg-gradient-to-r from-emerald-600 via-yellow-500 to-red-500'
            }`}
            style={{
              width: `${progress * 100}%`,
              boxShadow: isReversing
                ? '0 0 12px rgba(59,130,246,0.5)'
                : glitchText
                  ? '0 0 16px rgba(234,179,8,0.7)'
                  : undefined,
            }}
          />
        </div>

        {/* Sub-label */}
        <p className="text-center text-gray-700 text-xs">
          {glitchText
            ? '⚠️ 시간 오류 감지됨'
            : isReversing
              ? '⏪ 시간이 역행하고 있습니다'
              : `${60 - displaySeconds}초 남았습니다`}
        </p>
      </div>

      {/* Error modals */}
      {errorModal === 'system' && (
        <SystemErrorModal onOk={() => handleErrorConfirm('system_error')} />
      )}
      {errorModal === 'update' && (
        <UpdateModal onOk={() => handleErrorConfirm('update_required')} />
      )}
      {errorModal === 'virus' && (
        <VirusModal onOk={() => handleErrorConfirm('virus_found')} />
      )}
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

function IntroView({
  nickname,
  collected,
  onStart,
  onCollection,
}: {
  nickname: string
  collected: Set<EndingId>
  onStart: () => void
  onCollection: () => void
}) {
  const pct = Math.round((collected.size / ALL_ENDING_IDS.length) * 100)

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 gap-7">
      {/* Title */}
      <div className="text-center fade-in-up">
        <div className="text-5xl mb-3">⏱️</div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">60초 챌린지</h1>
        <p className="text-gray-500 text-sm">60초를 채우면 상품이 있습니다*</p>
        <p className="text-gray-700 text-xs mt-1">*상품은 존재하지 않습니다</p>
      </div>

      {/* Nickname */}
      <div className="text-center bg-gray-900 rounded-2xl px-6 py-4 border border-gray-800 w-full max-w-xs">
        <p className="text-gray-500 text-xs mb-1.5">오늘의 닉네임</p>
        <p className="text-white font-bold text-lg">{nickname}</p>
      </div>

      {/* Collected endings preview */}
      {collected.size > 0 && (
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-500 text-xs">엔딩 수집 현황</span>
            <span className="text-gray-500 text-xs">{collected.size}/{ALL_ENDING_IDS.length}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {ALL_ENDING_IDS.map(id => (
              <span
                key={id}
                title={collected.has(id) ? ENDINGS[id].title : '???'}
                className={`text-lg ${collected.has(id) ? '' : 'grayscale opacity-20'}`}
              >
                {ENDINGS[id].emoji}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={onStart}
        className="bg-white text-black font-black text-xl px-14 py-4 rounded-2xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg"
      >
        시작하기
      </button>

      {/* Collection link */}
      {collected.size > 0 && (
        <button
          onClick={onCollection}
          className="text-gray-500 text-sm hover:text-gray-300 transition-colors"
        >
          📖 엔딩 도감 ({collected.size}/{ALL_ENDING_IDS.length})
        </button>
      )}

      {collected.size === 0 && (
        <p className="text-gray-700 text-xs text-center">
          다양한 방법으로 실패해 보세요.<br />
          실패 방법을 모두 수집하면 엔딩 도감이 완성됩니다.
        </p>
      )}
    </div>
  )
}

function EndingView({
  ending,
  collected,
  onRetry,
  onCollection,
}: {
  ending: EndingDef
  collected: Set<EndingId>
  onRetry: () => void
  onCollection: () => void
}) {
  const isNew = true // It was just added so it's always "new" in this context

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 gap-5">
      {/* New badge */}
      {isNew && (
        <div
          className="text-xs font-bold px-3 py-1 rounded-full fade-in-up"
          style={{
            background: RARITY_BG[ending.rarity],
            color: RARITY_COLOR[ending.rarity],
            border: `1px solid ${RARITY_COLOR[ending.rarity]}40`,
          }}
        >
          ✨ 엔딩 획득! [{RARITY_LABEL[ending.rarity]}]
        </div>
      )}

      {/* Emoji */}
      <div className="text-7xl animate-bounce">{ending.emoji}</div>

      {/* Title */}
      <div className="text-center fade-in-up">
        <h2 className="text-3xl font-black text-white mb-1">{ending.title}</h2>
        <p className="text-gray-500 text-sm">{ending.desc}</p>
      </div>

      {/* Message box */}
      <div
        className="rounded-2xl p-5 max-w-sm w-full border"
        style={{
          background: RARITY_BG[ending.rarity],
          borderColor: `${RARITY_COLOR[ending.rarity]}30`,
        }}
      >
        {ending.msg.map((line, i) => (
          <p
            key={i}
            className="text-sm text-center leading-relaxed"
            style={{ color: ending.color, opacity: 0.7 + i * 0.1 }}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Progress */}
      <div className="text-center">
        <p className="text-gray-600 text-xs mb-2">
          수집한 엔딩: {collected.size} / {ALL_ENDING_IDS.length}
        </p>
        <div className="flex gap-1.5 justify-center">
          {ALL_ENDING_IDS.map(id => (
            <span
              key={id}
              className={`text-base ${collected.has(id) ? '' : 'grayscale opacity-15'}`}
            >
              {ENDINGS[id].emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-1">
        <button
          onClick={onRetry}
          className="bg-white text-black font-bold px-8 py-3 rounded-xl hover:bg-gray-100 active:scale-95 transition-all text-sm"
        >
          다시 도전
        </button>
        <button
          onClick={onCollection}
          className="border border-gray-700 text-gray-400 font-bold px-8 py-3 rounded-xl hover:border-gray-500 hover:text-white active:scale-95 transition-all text-sm"
        >
          도감 보기
        </button>
      </div>
    </div>
  )
}

function CollectionView({
  collected,
  onBack,
}: {
  collected: Set<EndingId>
  onBack: () => void
}) {
  const total = ALL_ENDING_IDS.length
  const pct = Math.round((collected.size / total) * 100)

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4 border-b border-gray-800/50">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
        >
          ←
        </button>
        <div>
          <h2 className="text-xl font-black text-white">엔딩 도감</h2>
          <p className="text-gray-600 text-xs">수집한 엔딩: {collected.size}/{total} ({pct}%)</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 py-3">
        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="grid grid-cols-2 gap-3">
          {ALL_ENDING_IDS.map(id => {
            const e = ENDINGS[id]
            const unlocked = collected.has(id)
            return (
              <div
                key={id}
                className={`rounded-2xl p-4 border transition-all ${
                  unlocked
                    ? 'border-gray-700/50 bg-gray-900/80'
                    : 'border-gray-800/30 bg-gray-900/20'
                }`}
                style={unlocked ? { borderColor: `${RARITY_COLOR[e.rarity]}25` } : {}}
              >
                <div className={`text-3xl mb-2 ${unlocked ? '' : 'grayscale opacity-15'}`}>
                  {unlocked ? e.emoji : '❓'}
                </div>
                <div
                  className="text-xs mb-1 font-medium"
                  style={{ color: unlocked ? RARITY_COLOR[e.rarity] : '#1f2937' }}
                >
                  {unlocked ? RARITY_LABEL[e.rarity] : '???'}
                </div>
                <div className={`font-bold text-sm ${unlocked ? 'text-white' : 'text-gray-800'}`}>
                  {unlocked ? e.title : '???'}
                </div>
                {unlocked && (
                  <div className="text-gray-500 text-xs mt-1 leading-tight">{e.desc}</div>
                )}
              </div>
            )
          })}
        </div>

        {collected.size === total && (
          <div className="mt-6 text-center">
            <div className="text-4xl mb-2">🎊</div>
            <p className="text-yellow-400 font-bold text-lg">전체 수집 완료!</p>
            <p className="text-gray-500 text-xs mt-1">모든 엔딩을 수집했습니다. 대단합니다!</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== ERROR MODALS ====================

function SystemErrorModal({ onOk }: { onOk: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="win98-modal bg-[#c0c0c0] text-black max-w-xs w-full shadow-2xl">
        {/* Title bar */}
        <div className="win98-title flex items-center justify-between px-2 py-1">
          <span className="text-white text-xs font-bold flex items-center gap-1.5">
            <span>💻</span> 오류
          </span>
          <button
            onClick={onOk}
            className="bg-[#c0c0c0] text-black w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-500 hover:text-white border border-gray-400"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex gap-3 items-start">
          <div className="text-4xl flex-shrink-0">⛔</div>
          <div>
            <p className="font-bold text-sm mb-1">치명적인 오류가 발생했습니다</p>
            <p className="text-xs text-gray-700 leading-relaxed mb-3">
              오류 코드: 0x0000DEAD<br />
              게임이 강제 종료됩니다.<br />
              오류 코드를 메모해두세요.<br />
              <span className="text-gray-500">(메모해도 의미 없음)</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={onOk}
                className="win98-modal bg-[#c0c0c0] text-black px-5 py-0.5 text-xs hover:bg-gray-400 active:border-inset font-bold"
              >
                확인
              </button>
              <button
                onClick={onOk}
                className="win98-modal bg-[#c0c0c0] text-black px-5 py-0.5 text-xs hover:bg-gray-400 font-bold text-gray-500"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function UpdateModal({ onOk }: { onOk: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white text-black rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden fade-in-up">
        <div className="bg-blue-600 px-5 py-3">
          <p className="text-white font-bold text-sm flex items-center gap-2">
            <span>🔄</span> 업데이트 필요
          </p>
        </div>
        <div className="p-5 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
            🔄
          </div>
          <p className="font-bold mb-1">버전 1.0.0 지원 종료</p>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            현재 버전은 더 이상 지원되지 않습니다.<br />
            2.0.0으로 업데이트하면 클리어할 수 있을지도<br />
            모릅니다.
            <br />
            <span className="text-gray-400">(모릅니다)</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onOk}
              className="flex-1 bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-blue-700 active:scale-95 transition-all"
            >
              업데이트
            </button>
            <button
              onClick={onOk}
              className="flex-1 bg-gray-100 text-gray-600 text-sm font-bold py-2.5 rounded-xl hover:bg-gray-200 active:scale-95 transition-all"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VirusModal({ onOk }: { onOk: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-950 border border-green-500/50 text-green-400 rounded-xl shadow-2xl max-w-xs w-full overflow-hidden fade-in-up">
        {/* Header */}
        <div className="bg-green-900/60 px-4 py-2.5 flex items-center gap-2 border-b border-green-500/30">
          <span>🛡️</span>
          <span className="font-bold text-sm">바이러스 방지 프로그램</span>
          <span className="ml-auto text-xs text-green-600">v9.99.999</span>
        </div>

        {/* Content */}
        <div className="p-5 font-mono text-xs">
          <div className="text-4xl text-center mb-3">🦠</div>
          <p className="text-red-400 font-bold text-center text-sm mb-4">⚠️ 바이러스 발견!</p>

          <div className="bg-black/50 rounded-lg p-3 space-y-1.5 mb-4 border border-green-900">
            <div className="flex justify-between">
              <span className="text-green-700">위협명:</span>
              <span className="text-green-300">Win60.Impossible.Exe</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">위험도:</span>
              <span className="text-red-400 font-bold">매우 높음</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">상태:</span>
              <span className="text-yellow-400">활성 중</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">권고:</span>
              <span className="text-red-400">즉시 종료</span>
            </div>
          </div>

          <button
            onClick={onOk}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-2.5 rounded-lg text-sm transition-all active:scale-95"
          >
            위협 제거 (게임 종료)
          </button>
        </div>
      </div>
    </div>
  )
}
