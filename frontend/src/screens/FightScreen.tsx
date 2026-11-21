import { useEffect, useState } from 'react'
import { api } from '../api'
import { Scene } from '../components/Scene'
import type { SceneEffect } from '../components/Scene'
import type { AnswerResult, Fight, RunOver, TraceStep } from '../types'

interface Props {
  userId: string
  runId: string
  nodeId: string
  onTrace: (label: string, steps: TraceStep[]) => void
  onCleared: () => void
  onRunOver: (result: RunOver) => void
}

const KEYS = ['1', '2', '3', '4']

export function FightScreen({ userId, runId, nodeId, onTrace, onCleared, onRunOver }: Props) {
  const [fight, setFight] = useState<Fight | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [hp, setHp] = useState(0)
  const [enemyHp, setEnemyHp] = useState(0)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [effect, setEffect] = useState<SceneEffect | null>(null)

  useEffect(() => {
    let alive = true
    api
      .enterNode(runId, nodeId)
      .then((f) => {
        if (!alive) return
        setFight(f)
        setCurrentId(f.current_q_id)
        setHp(f.player_hp)
        setEnemyHp(f.enemy.hp)
        if (f.trace.length) onTrace(`Boss prep: ${f.enemy.name}`, f.trace)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [runId, nodeId, onTrace])

  const question = fight?.questions.find((q) => q.q_id === currentId) ?? null

  function choose(index: number) {
    if (!question || pending || result) return
    setPending(true)
    setPicked(index)
    api
      .answer(userId, runId, question.q_id, index)
      .then((res) => {
        setResult(res)
        setHp(res.player_hp)
        setEnemyHp(res.enemy_hp)
        setEffect({ kind: res.correct ? 'enemy-hit' : 'player-hit', key: Date.now() })
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setPending(false))
  }

  function next() {
    if (!result) return
    if (result.run_over) onRunOver(result.run_over)
    else if (result.node_cleared) onCleared()
    else {
      setCurrentId(result.next_q_id)
      setResult(null)
      setPicked(null)
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return
      const i = KEYS.indexOf(event.key)
      if (i >= 0 && !result) choose(i)
      else if ((event.key === 'Enter' || event.key === ' ') && result) {
        event.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error) return <section className="screen"><p className="bad">{error}</p></section>
  if (!fight) return <section className="screen"><p className="muted blink">The enemy approaches...</p></section>

  const defeated = enemyHp <= 0
  return (
    <section className="screen fight">
      <div className="scene-wrap">
        <Scene
          level={fight.level}
          enemy={fight.enemy.name}
          enemyHp={enemyHp}
          enemyMaxHp={fight.enemy.max_hp}
          playerHp={hp}
          playerMaxHp={fight.max_hp}
          effect={effect}
          defeated={defeated}
        >
          {result && (
            <g>
              <rect x="62" y="30" width="86" height="18" fill="#0f0f1b" opacity="0.85" />
              <text x="105" y="43" textAnchor="middle" className={`scene-big ${result.correct ? 'ok' : 'bad'}`}>
                {defeated ? 'DEFEATED!' : result.correct ? 'HIT!' : 'OUCH!'}
              </text>
            </g>
          )}
        </Scene>
      </div>

      <div className="dialog">
        {question && (
          <>
            <div className="q-meta">
              <span>{fight.kind === 'boss' ? 'SUMMIT' : `LV ${fight.level}`} · {question.subtopic}</span>
              {question.slot === 'memory' && <span className="slot memory">MEMORY: you missed this before</span>}
              {question.slot === 'other_lecture' && (
                <span className="slot other">FROM ANOTHER LECTURE: {question.deck_name}</span>
              )}
            </div>
            <p className="q-prompt">{question.prompt}</p>
            <div className="choices">
              {question.choices.map((choice, i) => {
                let state = ''
                if (result) {
                  if (i === result.answer.index) state = 'right'
                  else if (i === picked) state = 'wrong'
                  else state = 'dim'
                }
                return (
                  <button
                    type="button"
                    key={i}
                    className={`choice ${state}`}
                    onClick={() => choose(i)}
                    disabled={pending || result !== null}
                  >
                    <span className="key">{i + 1}</span> {choice}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {result && (
          <div className={`feedback ${result.correct ? 'hit' : 'miss'}`}>
            <p className="verdict">
              {result.correct ? 'HIT! ' : 'OUCH! '}
              <span className="taunt">
                {fight.enemy.name}: "{result.taunt}"
              </span>
            </p>
            {result.quote && (
              <blockquote>
                <span className="quote-src">
                  SLIDE {result.quote.page ?? '?'} · {result.quote.deck_name}
                </span>
                "{result.quote.text}"
              </blockquote>
            )}
            {result.explanation && <p className="explain">{result.explanation}</p>}
            {!result.correct && !result.run_over && <p className="muted small">This question comes back before the fight ends.</p>}
            <button type="button" className="btn" onClick={next} autoFocus>
              {result.run_over ? 'SEE RESULTS ▶' : result.node_cleared ? 'CONTINUE THE CLIMB ▶' : 'NEXT ▶'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
