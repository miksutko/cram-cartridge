import { useEffect, useRef } from 'react'
import { backgroundCanvas, drawAtmosphere, H, makeAtmos, SCREEN_H, W, type SceneId } from '../art/backgrounds'
import { prefersReducedMotion } from '../game/settings'

interface Props {
  biome: SceneId
  className?: string
  /** Turn the moving layer off (e.g. behind a busy overlay). */
  still?: boolean
}

export function Background({ biome, className = '', still = false }: Props) {
  const base = useRef<HTMLCanvasElement>(null)
  const top = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = base.current?.getContext('2d')
    if (ctx) {
      const scene = backgroundCanvas(biome)
      const extra = SCREEN_H - H
      ctx.clearRect(0, 0, W, SCREEN_H)
      ctx.drawImage(scene, 0, 0)
      // extend the ground: repeat the bottom strip of the scene below it
      ctx.drawImage(scene, 0, H - extra, W, extra, 0, H, W, extra)
    }
  }, [biome])

  useEffect(() => {
    const ctx = top.current?.getContext('2d')
    if (!ctx) return
    const atmos = makeAtmos(biome)
    if (still || prefersReducedMotion()) {
      drawAtmosphere(ctx, biome, atmos, 0)
      return
    }
    let t = 0
    let last = 0
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 66) return
      last = now
      drawAtmosphere(ctx, biome, atmos, t++)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [biome, still])

  return (
    <div className={`bg ${className}`}>
      <canvas ref={base} width={W} height={SCREEN_H} />
      <canvas ref={top} width={W} height={H} />
    </div>
  )
}
