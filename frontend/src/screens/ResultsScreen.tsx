import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Report, RunOver } from '../types'

interface Props {
  userId: string
  deckId: string
  deckName: string
  result: RunOver
  onReplay: () => void
  onShelf: () => void
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ResultsScreen({ userId, deckId, deckName, result, onReplay, onShelf }: Props) {
  const [report, setReport] = useState<Report | null>(null)

  useEffect(() => {
    let alive = true
    api
      .report(userId)
      .then((res) => {
        if (alive) setReport(res)
      })
      .catch(() => {
        /* the run stats below still show */
      })
    return () => {
      alive = false
    }
  }, [userId])

  const deckSubtopics = report?.subtopics.filter((s) => s.deck_id === deckId) ?? []
  return (
    <section className="screen results">
      <h1 className={result.won ? 'ok' : 'bad'}>{result.won ? 'SUMMIT REACHED!' : 'YOU FELL...'}</h1>
      <p className="muted">{deckName}</p>

      <div className="stats">
        <div><span>SCORE</span><strong>{result.score}</strong></div>
        <div><span>BEST</span><strong>{result.best_score}</strong></div>
        <div><span>ACCURACY</span><strong>{Math.round(result.accuracy * 100)}%</strong></div>
        <div><span>CORRECT</span><strong>{result.correct}/{result.answered}</strong></div>
        <div><span>TIME</span><strong>{clock(result.time_s)}</strong></div>
        <div><span>HP LEFT</span><strong>{result.hp_left}</strong></div>
      </div>

      <h2>WEAK SPOTS THIS RUN</h2>
      {result.weak_spots.length === 0 ? (
        <p className="ok">None. Flawless climb.</p>
      ) : (
        <ul className="weak">
          {result.weak_spots.map((w) => (
            <li key={w.subtopic}>
              {w.subtopic} <span className="bad">missed {w.missed}x</span>
            </li>
          ))}
        </ul>
      )}

      {deckSubtopics.length > 0 && (
        <>
          <h2>ALL RUNS ON THIS CARTRIDGE</h2>
          <ul className="bars">
            {deckSubtopics.map((s) => (
              <li key={s.subtopic}>
                <span className="bar-label">{s.subtopic}</span>
                <span className="bar">
                  <span className="bar-fill" style={{ width: `${Math.round(s.accuracy * 100)}%` }} />
                </span>
                <span className="bar-pct">{Math.round(s.accuracy * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Climb again and your weak spots come first.</p>
        </>
      )}

      <div className="row">
        <button type="button" className="btn big" onClick={onReplay} autoFocus>
          CLIMB AGAIN ▶
        </button>
        <button type="button" className="btn" onClick={onShelf}>
          SHELF
        </button>
      </div>
    </section>
  )
}
