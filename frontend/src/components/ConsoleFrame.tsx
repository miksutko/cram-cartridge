import type { ReactNode } from 'react'
import { COMPACT_H, CONSOLE_H, CONSOLE_W, useScale } from './useScale'

interface Props {
  children: ReactNode
  /** Something sliding into the cartridge slot (attract sequence). */
  slot?: ReactNode
  powered?: boolean
  badges?: ReactNode
}

/**
 * An original handheld: rounded slate body, a cartridge slot on top, a screen with
 * a bevelled bezel, a rune-shaped D-pad and two gem buttons. No real console's shape or name.
 */
export function ConsoleFrame({ children, slot, powered = true, badges }: Props) {
  const { scale, compact } = useScale()
  const h = compact ? COMPACT_H : CONSOLE_H
  return (
    <div className="console-outer" style={{ width: CONSOLE_W * scale, height: h * scale }}>
      <div className={`console ${compact ? 'compact' : ''}`} style={{ transform: `scale(${scale})`, height: h }}>
        <div className="console-slot">
          <div className="console-slot-mouth" />
          <div id="slot-portal" />
          {slot}
        </div>
        <div className="console-bezel">
          <div className={`console-led ${powered ? 'on' : ''}`} />
          <div className="screen">{children}</div>
          {badges}
        </div>
        <div className="console-controls">
          <div className="dpad">
            <span className="dpad-h" />
            <span className="dpad-v" />
          </div>
          <div className="console-brand">CRAM · CARTRIDGE</div>
          <div className="gems">
            <span className="gem gem-b" />
            <span className="gem gem-a" />
          </div>
        </div>
      </div>
    </div>
  )
}
