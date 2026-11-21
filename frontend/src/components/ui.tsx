import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Sprite } from '../art/Sprite'
import { GAME } from '../game/content'
import { settings, TEXT_MS } from '../game/settings'
import { useStore } from '../game/store'

export function PixelBox({ children, className = '', tone = 'dark' }: { children: ReactNode; className?: string; tone?: 'dark' | 'paper' | 'gold' }) {
  return <div className={`pbox pbox-${tone} ${className}`}>{children}</div>
}

export function Hearts({ hp, max }: { hp: number; max: number }) {
  const slots = Array.from({ length: Math.max(max, 0) }, (_, i) => (hp >= i + 1 ? 'full' : hp > i ? 'half' : 'empty'))
  return (
    <span className="hearts" aria-label={`${hp} of ${max} hearts`}>
      {slots.map((a, i) => (
        <Sprite key={i} id="heart" anim={a} />
      ))}
    </span>
  )
}

export function HpBar({ hp, max, colors, label }: { hp: number; max: number; colors?: [string, string, string]; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0
  const [, mid, light] = colors ?? ['#000', '#d8202a', '#ff6a5a']
  return (
    <span className="hpbar" aria-label={label ?? `${hp} of ${max}`}>
      <span className="hpbar-fill" style={{ width: `${pct * 100}%`, background: `linear-gradient(${light} 0 34%, ${mid} 34% 100%)` }} />
    </span>
  )
}

/** Text that types itself out at the text speed setting. Click finishes it. */
export function Typewriter({ text, className = '', onDone }: { text: string; className?: string; onDone?: () => void }) {
  const { textSpeed } = useStore(settings)
  const ms = TEXT_MS[textSpeed]
  const [st, setSt] = useState({ text, n: 0 })
  if (st.text !== text) setSt({ text, n: 0 })
  const n = ms === 0 ? text.length : Math.min(st.text === text ? st.n : 0, text.length)
  const done = useRef(false)
  useEffect(() => {
    done.current = false
    if (ms === 0) return
    const id = window.setInterval(() => {
      setSt((s) => (s.n >= s.text.length ? s : { ...s, n: s.n + 1 }))
    }, ms)
    return () => window.clearInterval(id)
  }, [text, ms])
  useEffect(() => {
    if (n >= text.length && !done.current) {
      done.current = true
      onDone?.()
    }
  }, [n, text, onDone])
  return (
    <span className={className} onClick={() => setSt({ text, n: text.length })}>
      {text.slice(0, n)}
      {n < text.length && <span className="tw-cursor">▌</span>}
    </span>
  )
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? 'logo-small' : ''}`} aria-label={GAME.title}>
      <span className="logo-l1">CRAM</span>
      <span className="logo-l2">CARTRIDGE</span>
    </div>
  )
}

export function MessageBox({ title, text, onClose, action = 'OK' }: { title?: string; text: string; onClose?: () => void; action?: string }) {
  return (
    <div className="overlay" role="alertdialog">
      <PixelBox className="msgbox">
        {title && <div className="msg-title">{title}</div>}
        <div className="msg-text">{text}</div>
        {onClose && (
          <button type="button" className="pbtn" onClick={onClose} autoFocus>
            {action} ▶
          </button>
        )}
      </PixelBox>
    </div>
  )
}

export function Blink({ children }: { children: ReactNode }) {
  return <span className="blink">{children}</span>
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="loading">
      <Sprite id="node-current" />
      <span className="blink">{text}</span>
    </div>
  )
}

