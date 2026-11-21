import type { CSSProperties } from 'react'
import { frameUrl } from './pixel'
import { overrides, sprites } from './registry'
import { useTick } from './tick'

interface Props {
  id: string
  /** Named animation (falls back to idle, then frame 0). */
  anim?: string
  /** Fixed frame index; overrides anim. */
  frame?: number
  scale?: number
  className?: string
  style?: CSSProperties
  /** Ticks per frame (220ms each). */
  speed?: number
  title?: string
}

export function Sprite({ id, anim = 'idle', frame, scale = 1, className = '', style, speed = 2, title }: Props) {
  const s = sprites[id]
  const seq = frame !== undefined ? [frame] : (s?.anims?.[anim] ?? s?.anims?.idle ?? [0])
  const t = useTick(speed, seq.length > 1)
  if (!s) return <span className={`sprite missing ${className}`} title={`missing sprite ${id}`} />
  const override = overrides[id]
  const src = override ?? frameUrl(s, seq[t % seq.length])
  return (
    <img
      className={`sprite ${className}`}
      src={src}
      width={s.w * scale}
      height={s.h * scale}
      style={style}
      alt={title ?? ''}
      title={title}
      draggable={false}
    />
  )
}
