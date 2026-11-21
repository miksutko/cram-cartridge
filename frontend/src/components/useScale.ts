import { useEffect, useState } from 'react'
import { settings } from '../game/settings'
import { useStore } from '../game/store'

/** Logical size of the whole handheld (screen 240x160 plus the bezel). */
export const CONSOLE_W = 272
export const CONSOLE_H = 236

function autoScale(): number {
  const w = window.innerWidth - 16
  const h = window.innerHeight - 16
  return Math.max(1, Math.min(4, Math.floor(Math.min(w / CONSOLE_W, h / CONSOLE_H))))
}

export function useScale(): number {
  const s = useStore(settings)
  const [auto, setAuto] = useState(autoScale)
  useEffect(() => {
    const on = () => setAuto(autoScale())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  if (s.scale === 'auto') return auto
  // never larger than fits, never below 1
  return Math.max(1, Math.min(s.scale, Math.max(auto, 1)))
}

