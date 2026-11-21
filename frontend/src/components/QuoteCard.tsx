import { useState } from 'react'
import { Sprite } from '../art/Sprite'
import { Typewriter } from './ui'
import { useKeys } from './keys'

interface Props {
  enemy: string
  enemySprite: string
  taunt: string
  quote: { text: string; page: number | null; deck_name: string } | null
  explanation: string
  answer?: string
  onClose: () => void
}

/** Shown after a wrong answer: the enemy's taunt, the exact slide line missed, and why. */
export function QuoteCard({ enemy, enemySprite, taunt, quote, explanation, answer, onClose }: Props) {
  const [typed, setTyped] = useState(false)
  useKeys({ Enter: () => (typed ? onClose() : setTyped(true)), ' ': () => (typed ? onClose() : setTyped(true)), Escape: onClose })
  return (
    <div className="overlay quote-overlay" onClick={() => (typed ? onClose() : setTyped(true))}>
      <div className="taunt-row">
        <div className="taunt-face">
          <Sprite id={enemySprite} />
        </div>
        <div className="bubble">
          <b>{enemy}:</b> “{taunt}”
        </div>
      </div>
      <div className="quote-card">
        <div className="quote-head">
          <span>THE SLIDE YOU MISSED</span>
          {quote && (
            <span className="quote-ref">
              {quote.deck_name}
              {quote.page !== null ? ` · SLIDE ${quote.page}` : ''}
            </span>
          )}
        </div>
        <div className="quote-text">
          {quote ? <Typewriter text={`“${quote.text}”`} onDone={() => setTyped(true)} key={quote.text} /> : <span>(no slide quote for this one)</span>}
        </div>
        {answer && (
          <div className="quote-answer">
            ANSWER: <b>{answer}</b>
          </div>
        )}
        {explanation && <div className="quote-explain">{explanation}</div>}
        <div className="quote-foot blink">ENTER ▶</div>
      </div>
    </div>
  )
}
