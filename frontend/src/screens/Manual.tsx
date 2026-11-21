import { useState } from 'react'
import { Sprite } from '../art/Sprite'
import { useKeys } from '../components/keys'
import { MANUAL, NODE_INFO } from '../game/content'
import { sfx } from '../game/sfx'

/** HOW TO PLAY: a 4-page spellbook. Doubles as the judges' 20-second explainer. */
export function Manual({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState(0)
  const [flip, setFlip] = useState(0)
  const turn = (d: number) => {
    setPage((p) => {
      const n = Math.max(0, Math.min(MANUAL.length - 1, p + d))
      if (n !== p) {
        sfx('blip')
        setFlip((f) => f + 1)
      }
      return n
    })
  }
  useKeys({
    ArrowRight: () => turn(1),
    d: () => turn(1),
    ArrowLeft: () => turn(-1),
    a: () => turn(-1),
    Enter: () => (page === MANUAL.length - 1 ? onBack() : turn(1)),
    ' ': () => turn(1),
    Escape: onBack,
  })
  const p = MANUAL[page]
  return (
    <div className="scr manual">
      <div className="book">
        <div className="book-page left">
          <div className="book-rune">✦ HOW TO PLAY ✦</div>
          <div className="book-chapter">CHAPTER {page + 1}</div>
          <div className="book-title">{p.title}</div>
          <div className="book-art">
            {page === 0 && <Sprite id="cartridge" />}
            {page === 1 && (
              <>
                <Sprite id="player" anim="attack" />
                <Sprite id="torchmite" />
              </>
            )}
            {page === 2 && <Sprite id="node-current" />}
            {page === 3 && <Sprite id="chest" anim="open" />}
          </div>
        </div>
        <div className="book-page right" key={flip}>
          {p.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {'nodes' in p && p.nodes && (
            <ul className="book-nodes">
              {Object.entries(NODE_INFO).map(([k, n]) => (
                <li key={k}>
                  <Sprite id={n.icon} /> <b>{n.label}</b> {n.help}
                </li>
              ))}
            </ul>
          )}
          <div className="book-foot">
            {page > 0 ? '◀ ' : '  '}
            {page + 1}/{MANUAL.length}
            {page < MANUAL.length - 1 ? ' ▶' : ' · ENTER: CLOSE'}
          </div>
        </div>
      </div>
    </div>
  )
}
