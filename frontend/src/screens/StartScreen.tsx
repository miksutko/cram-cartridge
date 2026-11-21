import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sprite } from '../art/Sprite'
import { Background } from '../components/Background'
import { Blink, Logo } from '../components/ui'
import { useMenu } from '../components/keys'
import { toggleDev } from '../game/dev'
import { GAME } from '../game/content'
import { prefersReducedMotion } from '../game/settings'
import { sfx } from '../game/sfx'

interface Props {
  attract: boolean
  onStart: () => void
  onManual: () => void
  onSettings: () => void
}

const SLIDE = 'Big-O: the cost of an algorithm as input grows'
const IDLE_MS = 30_000

/**
 * The 10-second hook. An ~8s attract sequence (skippable with any key), then the menu.
 * 0-2s slide drops in · 2-4s it turns into the Minotaur · 4-6s wrong answer, hit · 6-8s quote card + logo.
 */
function Attract({ onEnd }: { onEnd: () => void }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const id = window.setInterval(() => {
      const s = (performance.now() - start) / 1000
      setT(s)
      if (s > 9.2) {
        window.clearInterval(id)
        onEnd()
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [onEnd])
  useEffect(() => {
    const skip = () => onEnd()
    const id = window.setTimeout(() => {
      window.addEventListener('keydown', skip)
      window.addEventListener('pointerdown', skip)
    }, 150)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [onEnd])

  const [slotEl] = useState(() => document.getElementById('slot-portal'))
  const on = t >= 2
  const pixels = t >= 2.4 && t < 3.6
  const monster = t >= 3.1
  const question = t >= 4 && t < 6.2
  const picked = t >= 4.9
  const hit = t >= 5.2 && t < 5.7
  const quote = t >= 6
  const logo = t >= 7
  return (
    <div className={`scr attract ${hit ? 'shake' : ''}`}>
      {!on && <div className="attract-off" />}
      {!on && slotEl && createPortal(<div className="slot-slide">{SLIDE}</div>, slotEl)}
      {on && (
        <>
          <Background biome="l1" className={t < 2.4 ? 'flicker-on' : ''} />
          {t < 3 && <div className={`attract-slide on-screen ${pixels ? 'shatter' : ''}`}>{SLIDE}</div>}
          {pixels && (
            <div className="pixel-burst">
              {Array.from({ length: 36 }, (_, i) => (
                <span key={i} style={{ left: `${30 + (i % 12) * 15}px`, top: `${56 + Math.floor(i / 12) * 8}px`, animationDelay: `${(i % 7) * 40}ms`, ['--tx' as string]: `${150 + (i % 6) * 6 - (30 + (i % 12) * 15)}px`, ['--ty' as string]: `${(Math.floor(i / 6) % 6) * 9 - 10}px` }} />
              ))}
            </div>
          )}
          {monster && (
            <div className={`attract-boss ${t < 3.6 ? 'assemble' : ''} ${hit ? 'lunge-left' : ''}`}>
              <Sprite id="minotaur" anim={hit ? 'attack' : 'idle'} />
            </div>
          )}
          {monster && (
            <div className={`attract-player ${hit ? 'flash' : ''}`}>
              <Sprite id="player" anim={hit ? 'hurt' : 'idle'} />
            </div>
          )}
          {question && (
            <div className="qbox attract-q">
              <div className="q-prompt">What is the time complexity of binary search?</div>
              <div className={`choice ${picked ? 'wrong' : 'sel'}`}>1 O(n)</div>
              <div className={`choice ${picked ? 'right' : ''}`}>2 O(log n)</div>
            </div>
          )}
          {quote && !logo && (
            <div className="attract-quote quote-card">
              <div className="quote-head">THE SLIDE YOU MISSED · SLIDE 1</div>
              <div className="quote-text">“{SLIDE}”</div>
            </div>
          )}
          {logo && (
            <div className="attract-logo">
              <Logo />
              <div className="hook">{GAME.hook}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function StartScreen({ attract, onStart, onManual, onSettings }: Props) {
  const [showAttract, setShowAttract] = useState(attract && !prefersReducedMotion())
  const typed = useRef('')
  const [devFlash, setDevFlash] = useState(false)
  const items = [
    { label: 'START', run: onStart },
    { label: 'HOW TO PLAY', run: onManual },
    { label: 'SETTINGS', run: onSettings },
  ]
  const [sel, setSel] = useMenu(
    items.length,
    (i) => {
      sfx('confirm')
      items[i].run()
    },
    !showAttract,
  )

  // Replay the attract sequence after 30 idle seconds.
  useEffect(() => {
    if (showAttract) return
    let id = window.setTimeout(() => setShowAttract(true), IDLE_MS)
    const reset = () => {
      window.clearTimeout(id)
      id = window.setTimeout(() => setShowAttract(true), IDLE_MS)
    }
    window.addEventListener('keydown', reset)
    window.addEventListener('pointerdown', reset)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', reset)
      window.removeEventListener('pointerdown', reset)
    }
  }, [showAttract])

  // Typing "snow" toggles dev mode.
  useEffect(() => {
    if (showAttract) return
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!['s', 'n', 'o', 'w'].includes(k)) {
        typed.current = ''
        return
      }
      typed.current = (typed.current + k).slice(-4)
      if (typed.current === 'snow') {
        typed.current = ''
        toggleDev()
        setDevFlash(true)
        window.setTimeout(() => setDevFlash(false), 900)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [showAttract])

  if (showAttract) return <Attract onEnd={() => setShowAttract(false)} />

  return (
    <div className="scr start">
      <Background biome="summit" />
      <div className="start-dragon">
        <Sprite id="retep" />
      </div>
      <div className="start-logo">
        <Logo />
        <div className="hook">{GAME.hook}</div>
      </div>
      <div className="start-menu">
        {items.map((it, i) => (
          <button
            type="button"
            key={it.label}
            className={`menu-item ${sel === i ? 'sel' : ''}`}
            onMouseEnter={() => setSel(i)}
            onClick={() => {
              sfx('confirm')
              it.run()
            }}
          >
            {sel === i ? '▶ ' : '  '}
            {i === 0 ? <Blink>{GAME.pressStart}</Blink> : it.label}
          </button>
        ))}
      </div>
      {devFlash && <div className="toast">DEBUG PORT TOGGLED</div>}
    </div>
  )
}
