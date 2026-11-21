import { useEffect, useState } from 'react'
import type { RunCtx } from '../App'
import { api } from '../api/client'
import type { Report, ReportSubtopic, RunOver, ScoreRow } from '../api/types'
import type { BiomeId } from '../art/backgrounds'
import { Sprite } from '../art/Sprite'
import { Background } from '../components/Background'
import { Loading, PixelBox } from '../components/ui'
import { useKeys } from '../components/keys'
import { BIOMES, LINES } from '../game/content'
import { playerName } from '../game/settings'
import { load, save } from '../game/storage'
import { BESTS } from './ShelfScreen'

interface Props {
  userId: string
  run: RunCtx
  result: RunOver
  onReplay: () => void
  onShelf: () => void
}

const LOCAL_SCORES = 'cram-scores'
const PAGES = ['RESULTS', 'HIGH SCORES', 'WEAK SPOTS', "ADVENTURER'S LEDGER"]
const pct = (x: number) => `${Math.round(x * 100)}%`
const LEVEL_IDS: BiomeId[] = ['l1', 'l2', 'l3', 'l4', 'l5']

function biomeForSubtopic(run: RunCtx, subtopic: string): BiomeId {
  const i = run.deck.subtopics?.indexOf(subtopic) ?? -1
  return i >= 0 && i < 5 ? LEVEL_IDS[i] : 'summit'
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function ResultsScreen({ userId, run, result, onReplay, onShelf }: Props) {
  const [page, setPage] = useState(0)
  const [report, setReport] = useState<Report | null>(null)
  const [scores, setScores] = useState<{ rows: ScoreRow[]; local: boolean } | null>(null)

  // Record this run locally (fallback high scores and the shelf's best score).
  const [recorded] = useState(() => {
    const bests = load<Record<string, number>>(BESTS, {})
    bests[run.deck.deck_id] = Math.max(bests[run.deck.deck_id] ?? 0, result.score)
    save(BESTS, bests)
    const all = load<Record<string, ScoreRow[]>>(LOCAL_SCORES, {})
    const row: ScoreRow = { player_name: playerName(), score: result.score, accuracy: result.accuracy, time_s: result.time_s, at: Date.now() }
    all[run.deck.deck_id] = [...(all[run.deck.deck_id] ?? []), row].sort((a, b) => b.score - a.score).slice(0, 10)
    save(LOCAL_SCORES, all)
    return row
  })

  useEffect(() => {
    let alive = true
    api.report(userId).then((r) => alive && setReport(r)).catch(() => alive && setReport({ subtopics: [], stats: { answered: 0, correct: 0, accuracy: 0, runs_finished: 0, best_score: 0 } }))
    api
      .scores(run.deck.deck_id)
      .then((s) => alive && setScores({ rows: s.scores, local: false }))
      .catch(() => {
        // No high score endpoint (or it failed): this browser's bests, including this run.
        if (!alive) return
        const local = load<Record<string, ScoreRow[]>>(LOCAL_SCORES, {})[run.deck.deck_id] ?? [recorded]
        setScores({ rows: local, local: true })
      })
    return () => {
      alive = false
    }
  }, [userId, run.deck.deck_id, recorded])

  const nextPage = () => setPage((p) => Math.min(PAGES.length - 1, p + 1))
  const prevPage = () => setPage((p) => Math.max(0, p - 1))
  useKeys({
    ArrowRight: nextPage,
    d: nextPage,
    Enter: () => (page < PAGES.length - 1 ? nextPage() : onShelf()),
    ' ': nextPage,
    ArrowLeft: prevPage,
    a: prevPage,
    Escape: onShelf,
    r: onReplay,
  })

  const mine = (report?.subtopics ?? []).filter((s) => s.deck_id === run.deck.deck_id)
  return (
    <div className={`scr results ${result.won ? 'won' : 'lost'}`}>
      <Background biome={result.won ? 'summit' : biomeForLast(run)} still={!result.won} />
      {result.won && <div className="sunrise" />}
      {!result.won && <div className="grey-veil" />}
      <div className="scr-title">
        {PAGES[page]} <span className="dim">{page + 1}/{PAGES.length}</span>
      </div>
      <div className="results-body">
        {page === 0 && <Outcome run={run} result={result} />}
        {page === 1 && (scores ? <Scores rows={scores.rows} local={scores.local} mine={recorded} /> : <Loading text="Counting the gold..." />)}
        {page === 2 && (report ? <WeakSpots run={run} rows={mine} result={result} onReplay={onReplay} /> : <Loading text="Reading the runes..." />)}
        {page === 3 && (report ? <Ledger run={run} result={result} rows={mine} /> : <Loading text="Opening the ledger..." />)}
      </div>
      <div className="hint-line bottom">◀ ▶ PAGES · R REPLAY · ESC SHELF</div>
    </div>
  )
}

function biomeForLast(run: RunCtx): BiomeId {
  const l = run.lastLevel
  return l === 'summit' ? 'summit' : l ? LEVEL_IDS[Number(l) - 1] ?? 'l1' : 'l1'
}

function Outcome({ run, result }: { run: RunCtx; result: RunOver }) {
  const bosses = result.bosses_beaten ?? run.bosses
  return (
    <div className="outcome">
      <div className={`outcome-title ${result.won ? 'ok' : 'bad'}`}>{result.won ? LINES.victory : LINES.defeat}</div>
      <div className="outcome-row">
        <Sprite id="player" anim={result.won ? 'attack' : 'hurt'} />
        <PixelBox className="stats">
          <div><span>SCORE</span><b>{result.score}</b></div>
          <div><span>BEST</span><b>{result.best_score}</b></div>
          <div><span>ACCURACY</span><b>{pct(result.accuracy)}</b></div>
          <div><span>TIME</span><b>{fmtTime(result.time_s)}</b></div>
          <div><span>ANSWERED</span><b>{result.correct}/{result.answered}</b></div>
          <div><span>BOSSES</span><b>{bosses.length ? bosses.join(', ') : 'none'}</b></div>
        </PixelBox>
      </div>
    </div>
  )
}

function Scores({ rows, local, mine }: { rows: ScoreRow[]; local: boolean; mine: ScoreRow }) {
  return (
    <PixelBox className="scores">
      <ol>
        {rows.slice(0, 8).map((r, i) => (
          <li key={`${r.player_name}-${r.score}-${r.at ?? i}`} className={r.at === mine.at && r.score === mine.score ? 'me' : ''}>
            <span className="rank">{i + 1}.</span>
            <span className="who">{r.player_name}</span>
            <span className="pts">{r.score}</span>
            {r.accuracy !== undefined && <span className="dim">{pct(r.accuracy)}</span>}
          </li>
        ))}
      </ol>
      {local && <div className="dim small">Scores from this browser.</div>}
    </PixelBox>
  )
}

function WeakSpots({ run, rows, result, onReplay }: { run: RunCtx; rows: ReportSubtopic[]; result: RunOver; onReplay: () => void }) {
  const missedThisRun = new Map(result.weak_spots.map((w) => [w.subtopic, w.missed]))
  return (
    <div className="weak">
      {rows.length === 0 && <div className="dim">No answers recorded for this cartridge yet.</div>}
      {rows.map((s) => {
        const b = BIOMES[biomeForSubtopic(run, s.subtopic)]
        return (
          <div className="weak-row" key={s.subtopic}>
            <div className="weak-name">
              {s.subtopic}
              {missedThisRun.get(s.subtopic) ? <span className="bad"> · missed {missedThisRun.get(s.subtopic)} this run</span> : null}
            </div>
            <div className="weak-bar" style={{ background: b.colors[0] }}>
              <span style={{ width: `${s.accuracy * 100}%`, background: `linear-gradient(${b.colors[2]} 0 30%, ${b.colors[1]} 30%)` }} />
              <b>{pct(s.accuracy)}</b>
            </div>
            {s.missed_slides && s.missed_slides.length > 0 && (
              <div className="weak-slides">
                {s.missed_slides.slice(0, 2).map((m, i) => (
                  <div key={i} className="dim">
                    {m.page !== null ? `SLIDE ${m.page}: ` : ''}“{m.text}” ×{m.missed}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <button type="button" className="pbtn" onClick={onReplay}>
        {LINES.replay} ▶
      </button>
    </div>
  )
}

function Ledger({ run, result, rows }: { run: RunCtx; result: RunOver; rows: ReportSubtopic[] }) {
  const sorted = rows.slice().sort((a, b) => b.accuracy - a.accuracy)
  const strongest = sorted[0]
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
  const before = new Map((run.before?.subtopics ?? []).filter((s) => s.deck_id === run.deck.deck_id).map((s) => [s.subtopic, s]))
  const changes = rows.filter((s) => before.has(s.subtopic) && before.get(s.subtopic)!.accuracy !== s.accuracy)
  const lines: [string, string][] = [['Accuracy this climb', pct(result.accuracy)]]
  if (result.answered > 0 && result.time_s > 0) lines.push(['Time per question', `${(result.time_s / result.answered).toFixed(1)}s`])
  if (strongest) lines.push(['Strongest subtopic', `${strongest.subtopic} (${pct(strongest.accuracy)})`])
  if (weakest && weakest !== strongest) lines.push(['Weakest subtopic', `${weakest.subtopic} (${pct(weakest.accuracy)})`])
  lines.push(['Missed slides reviewed', String(run.quotesSeen)])
  return (
    <PixelBox className="ledger" tone="paper">
      <div className="ledger-title">THE LEDGER OF {playerName()}</div>
      {lines.map(([k, v]) => (
        <div className="ledger-line" key={k}>
          <span>{k}</span>
          <span className="dots" />
          <b>{v}</b>
        </div>
      ))}
      {rows.length > 0 && <div className="ledger-sub">BY SUBTOPIC (ALL CLIMBS)</div>}
      {rows.map((s) => (
        <div className="ledger-line" key={s.subtopic}>
          <span>{s.subtopic}</span>
          <span className="dots" />
          <b>
            {pct(s.accuracy)} <span className="dim">({s.correct}/{s.answered})</span>
          </b>
        </div>
      ))}
      {changes.length > 0 && <div className="ledger-sub">SINCE YOUR LAST CLIMB</div>}
      {changes.map((s) => (
        <div className="ledger-line" key={`c-${s.subtopic}`}>
          <span>{s.subtopic}</span>
          <span className="dots" />
          <b className={s.accuracy > before.get(s.subtopic)!.accuracy ? 'ok' : 'bad'}>
            {pct(before.get(s.subtopic)!.accuracy)} → {pct(s.accuracy)}
          </b>
        </div>
      ))}
    </PixelBox>
  )
}
