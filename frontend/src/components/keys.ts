import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Keyboard helper: maps keys to handlers while mounted. */
export function useKeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true): void {
  const ref = useRef(map)
  useLayoutEffect(() => {
    ref.current = map
  })
  useEffect(() => {
    if (!enabled) return
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.key !== 'Enter' && e.key !== 'Escape') return
      if (e.repeat && (e.key === 'Enter' || e.key === ' ')) return
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [enabled])
}

/** A vertical menu driven by arrows / WASD + Enter. */
export function useMenu(count: number, onPick: (i: number) => void, enabled = true, initial = 0) {
  const [i, setI] = useState(initial)
  const up = () => setI((k) => (k + count - 1) % Math.max(count, 1))
  const down = () => setI((k) => (k + 1) % Math.max(count, 1))
  useKeys(
    {
      ArrowUp: up,
      w: up,
      ArrowLeft: up,
      a: up,
      ArrowDown: down,
      s: down,
      ArrowRight: down,
      d: down,
      Enter: () => onPick(i),
      ' ': () => onPick(i),
    },
    enabled,
  )
  return [Math.min(i, Math.max(count - 1, 0)), setI] as const
}
