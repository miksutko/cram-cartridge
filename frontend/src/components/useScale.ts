import { useEffect, useState } from 'react'
import { settings } from '../game/settings'
import { useStore } from '../game/store'

/** Logical size of the whole handheld (screen 240x160 plus the bezel). */
export const CONSOLE_W = 272
export const CONSOLE_H = 236
/** Without the decorative controls row (used when it buys a bigger whole-number scale). */
export const COMPACT_H = 192

interface Fit {
  scale: number
  compact: boolean
}

function fit(): Fit {
  const w = window.innerWidth - 8
  const h = window.innerHeight - 8
  const byW = Math.floor(w / CONSOLE_W)
  const full = Math.min(byW, Math.floor(h / CONSOLE_H))
  const compact = Math.min(byW, Math.floor(h / COMPACT_H))
  if (compact > full) return { scale: Math.max(1, Math.min(4, compact)), compact: true }
  return { scale: Math.max(1, Math.min(4, full)), compact: false }
}

/** Whole-number scale for the console, and whether to drop the controls row to get it. */
export function useScale(): Fit {
  const s = useStore(settings)
  const [auto, setAuto] = useState(fit)
  useEffect(() => {
    const on = () => setAuto(fit())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (s.scale === 'auto') return auto
  // a fixed scale is still capped so the console never overflows the window
  return { scale: Math.max(1, Math.min(s.scale, auto.scale)), compact: auto.compact }
}
