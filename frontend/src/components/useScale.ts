import { useEffect, useState } from 'react'
import { settings } from '../game/settings'
import { useStore } from '../game/store'

/** Logical width of the handheld. */
export const CONSOLE_W = 272
/** The part that must fit in the window: cartridge slot, bezel and screen. */
export const VIEW_H = 202
/** The whole handheld; everything below VIEW_H simply runs off the bottom of the window. */
export const CONSOLE_H = 344

function fit(): number {
  const w = window.innerWidth - 8
  const h = window.innerHeight - 8
  return Math.max(1, Math.min(4, Math.floor(w / CONSOLE_W), Math.floor(h / VIEW_H)))
}

/** Whole-number scale so the slot, bezel and screen fit; the rest of the body hangs below. */
export function useScale(): number {
  const s = useStore(settings)
  const [auto, setAuto] = useState(fit)
  useEffect(() => {
    const on = () => setAuto(fit())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (s.scale === 'auto') return auto
  // a fixed scale is still capped so the screen never overflows the window
  return Math.max(1, Math.min(s.scale, auto))
}
