import type { ReactNode } from 'react'
import { CONSOLE_H, CONSOLE_W, useScale, VIEW_H } from './useScale'

interface Props {
  children: ReactNode
  /** Something sliding into the cartridge slot (attract sequence). */
  slot?: ReactNode
  powered?: boolean
  badges?: ReactNode
}

/**
 * An original handheld lying in front of you: the screen sits where it always has, and
 * the rest of the body (D-pad, gem buttons, start/select, speaker) runs off the bottom of
 * the window. Our own shape, buttons and name; no real console's design or branding.
 */
export function ConsoleFrame({ children, slot, powered = true, badges }: Props) {
  const scale = useScale()
  return (
    <div className="console-outer" style={{ width: CONSOLE_W * scale, height: VIEW_H * scale }}>
      <div className="console" style={{ transform: `scale(${scale})`, height: CONSOLE_H }}>
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
        <div className="console-body" aria-hidden="true">
          <div className="console-brand">CRAM · CARTRIDGE</div>
          <div className="dpad">
            <span className="dpad-h" />
            <span className="dpad-v" />
            <span className="dpad-hub" />
          </div>
          <div className="gems">
            <span className="gem gem-b" />
            <span className="gem gem-a" />
          </div>
          <div className="pills">
            <span className="pill" />
            <span className="pill" />
          </div>
          <div className="pill-labels">
            <span>MAP</span>
            <span>QUEST</span>
          </div>
          <div className="grille">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
