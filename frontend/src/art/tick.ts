import { useEffect, useState } from 'react'

// One shared animation clock for every sprite on screen.
let tick = 0
const listeners = new Set<(t: number) => void>()
let timer: number | null = null
function subscribe(fn: (t: number) => void): () => void {
  listeners.add(fn)
  if (timer === null) {
    timer = window.setInterval(() => {
      tick++
      listeners.forEach((l) => l(tick))
    }, 220)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }
}

export function useTick(divisor = 1, enabled = true): number {
  const [t, setT] = useState(tick)
  useEffect(() => {
    if (!enabled) return
    return subscribe((n) => {
      if (n % divisor === 0) setT(n)
    })
  }, [divisor, enabled])
  return Math.floor(t / divisor)
}

