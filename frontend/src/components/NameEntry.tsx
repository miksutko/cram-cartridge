import { useRef, useState } from 'react'
import { LINES } from '../game/content'
import { cleanName } from '../game/settings'
import { sfx } from '../game/sfx'
import { PixelBox } from './ui'
import { useKeys } from './keys'

const GRID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').concat([' ', '⌫', 'OK'])
const COLS = 10

/** "WHAT IS YOUR NAME, CLIMBER?" — type, or pick letters from the grid. */
export function NameEntry({ initial, onDone, onBack }: { initial: string; onDone: (name: string) => void; onBack?: () => void }) {
  const [name, setName] = useState(initial)
  const [cur, setCur] = useState(0)
  // Enter confirms the name after typing; after moving the grid cursor it presses that cell.
  const typedLast = useRef(false)

  const add = (ch: string) => {
    setName((n) => (n.length >= 10 ? n : (n + ch).toUpperCase()))
    sfx('blip')
  }
  const del = () => setName((n) => n.slice(0, -1))
  const done = () => {
    sfx('confirm')
    onDone(cleanName(name))
  }
  const press = (cell: string) => {
    if (cell === 'OK') done()
    else if (cell === '⌫') del()
    else add(cell)
  }
  const move = (d: number) => {
    typedLast.current = false
    setCur((c) => (c + d + GRID.length) % GRID.length)
  }
  const typeKey = (ch: string) => {
    typedLast.current = true
    add(ch)
  }

  useKeys({
    ArrowLeft: () => move(-1),
    ArrowRight: () => move(1),
    ArrowUp: () => move(-COLS),
    ArrowDown: () => move(COLS),
    Enter: () => (typedLast.current ? done() : press(GRID[cur])),
    Backspace: () => {
      typedLast.current = true
      del()
    },
    Escape: () => onBack?.(),
  })
  useKeys(
    Object.fromEntries(
      'abcdefghijklmnopqrstuvwxyz0123456789'.split('').map((k) => [k, () => typeKey(k.toUpperCase())]),
    ),
  )
  useKeys({ ' ': () => typeKey(' ') })

  return (
    <div className="name-entry">
      <PixelBox className="name-box">
        <div className="name-q">{LINES.namePrompt}</div>
        <div className="name-field">
          {name}
          <span className="tw-cursor blink">_</span>
          <span className="name-count">{name.length}/10</span>
        </div>
      </PixelBox>
      <div className="name-grid">
        {GRID.map((g, i) => (
          <button
            type="button"
            key={g + i}
            className={`name-cell ${i === cur ? 'sel' : ''} ${g.length > 1 ? 'wide' : ''}`}
            onClick={() => {
              setCur(i)
              press(g)
            }}
          >
            {g === ' ' ? '␣' : g}
          </button>
        ))}
      </div>
      <div className="hint-line">TYPE OR PICK · ENTER: OK · EMPTY = QUILL</div>
    </div>
  )
}
