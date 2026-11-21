import { useEffect, useState } from 'react'
import { api, errorText } from '../api/client'
import type { StatsResponse } from '../api/types'
import { Background } from '../components/Background'
import { Loading, PixelBox } from '../components/ui'
import { useKeys } from '../components/keys'

interface Props {
  userId: string
  onBack: () => void
}

const PAGES = ['YOUR CLIMBS', 'CARTRIDGES', 'POWERED BY SNOWFLAKE']
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '-' : `${Math.round(x * 100)}%`)
const num = (x: number | null | undefined) => (x === null || x === undefined ? '-' : x.toLocaleString('en-GB'))

/** STATS from the main menu: the player's history and what Snowflake has built, all read live. */
export function StatsScreen({ userId, onBack }: Props) {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .stats(userId)
      .then((d) => alive && setData(d))
      .catch((err) => alive && setError(errorText(err)))
    return () => {
      alive = false
    }
  }, [userId])

  const next = () => setPage((p) => Math.min(PAGES.length - 1, p + 1))
  const prev = () => setPage((p) => Math.max(0, p - 1))
  useKeys({ ArrowRight: next, d: next, ArrowLeft: prev, a: prev, Escape: onBack, Enter: () => (page < PAGES.length - 1 ? next() : onBack()) })

  return (
    <div className="scr results stats-screen">
      <Background biome="summit" still />
      <div className="grey-veil" />
      <div className="scr-title">
        {PAGES[page]} <span className="dim">{page + 1}/{PAGES.length}</span>
      </div>
      <div className="results-body">
        {error && <PixelBox className="stats-note">Stats are not available: {error}</PixelBox>}
        {!error && !data && <Loading text="Asking Snowflake..." />}
        {data && page === 0 && <You data={data} />}
        {data && page === 1 && <Cartridges data={data} />}
        {data && page === 2 && <Snowflake data={data} />}
      </div>
      <div className="hint-line bottom">◀ ▶ PAGES · ESC BACK</div>
    </div>
  )
}

function You({ data }: { data: StatsResponse }) {
  const s = data.you.stats
  const weakest = data.you.subtopics.slice(0, 5)
  const missed = data.you.subtopics.flatMap((t) => (t.missed_slides ?? []).map((m) => ({ ...m, subtopic: t.subtopic, deck: t.deck_name })))
  missed.sort((a, b) => b.missed - a.missed)
  return (
    <div className="stats-grid">
      <PixelBox className="stats">
        <div><span>QUESTIONS ANSWERED</span><b>{num(s.answered)}</b></div>
        <div><span>CORRECT</span><b>{num(s.correct)}</b></div>
        <div><span>ACCURACY</span><b>{pct(s.answered ? s.accuracy : null)}</b></div>
        <div><span>CLIMBS FINISHED</span><b>{num(s.runs_finished)}</b></div>
        <div><span>BEST SCORE</span><b>{num(s.best_score)}</b></div>
      </PixelBox>
      <div className="weak">
        <div className="stats-head">WEAKEST SUBTOPICS</div>
        {weakest.length === 0 && <div className="dim">Play a climb to see your weak spots here.</div>}
        {weakest.map((t) => (
          <div className="weak-row" key={`${t.deck_id}-${t.subtopic}`}>
            <div className="weak-name">
              {t.subtopic} <span className="dim">· {t.deck_name.replace(/^(Demo|Sample): /, '')}</span>
            </div>
            <div className="weak-bar">
              <span style={{ width: `${t.accuracy * 100}%` }} />
              <b>{pct(t.accuracy)}</b>
            </div>
          </div>
        ))}
        {missed.length > 0 && (
          <>
            <div className="stats-head">SLIDES YOU MISS MOST</div>
            {missed.slice(0, 3).map((m, i) => (
              <div className="weak-row" key={i}>
                <div className="weak-name dim">
                  {m.page !== null ? `SLIDE ${m.page} · ` : ''}
                  {m.deck.replace(/^(Demo|Sample): /, '')} · missed {m.missed}x
                </div>
                <div className="stats-quote">“{m.text}”</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Cartridges({ data }: { data: StatsResponse }) {
  if (data.cartridges.length === 0) return <PixelBox className="stats-note">No cartridges in Snowflake yet. Upload a lecture PDF from the shelf.</PixelBox>
  return (
    <div className="weak">
      {data.cartridges.map((c) => (
        <div className="weak-row stats-cart" key={c.name}>
          <div className="weak-name">
            {c.name.replace(/^(Demo|Sample): /, '')} <span className="dim">· {c.main_topic}</span>
          </div>
          <div className="stats-cols">
            <span>{c.slides} SLIDES</span>
            <span>{c.levels} LEVELS</span>
            <span>{c.questions} QUESTIONS</span>
            <span>{c.plays} CLIMBS</span>
            <span>BEST {num(c.best_score)}</span>
            <span>ACC {pct(c.accuracy)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Snowflake({ data }: { data: StatsResponse }) {
  const b = data.built
  const c = data.ai_calls_24h
  return (
    <div className="stats-grid stack">
      <PixelBox className="stats">
        <div className="stats-head">BUILT IN SNOWFLAKE</div>
        <div><span>CARTRIDGES</span><b>{num(b.cartridges)}</b></div>
        <div><span>PAGES PARSED</span><b>{num(b.pages)}</b></div>
        <div><span>TEXT CHUNKS</span><b>{num(b.chunks)}</b></div>
        <div><span>QUESTIONS WRITTEN</span><b>{num(b.questions)}</b></div>
        <div><span>VECTORS (1024-D)</span><b>{num(b.chunk_vectors + b.question_vectors)}</b></div>
        <div><span>ANSWERS SAVED</span><b>{num(b.answers_saved)}</b></div>
      </PixelBox>
      <PixelBox className="stats">
        <div className="stats-head">AI CALLS, LAST 24 HOURS</div>
        <div><span>AI_PARSE_DOCUMENT</span><b>{num(c.parse_document)}</b></div>
        <div><span>AI_COMPLETE</span><b>{num(c.complete)}</b></div>
        <div><span>AI_EMBED</span><b>{num(c.embed)}</b></div>
        <div><span>VECTOR_COSINE_SIMILARITY</span><b>{num(c.cosine)}</b></div>
        <div><span>ALL QUERIES</span><b>{num(c.all_queries)}</b></div>
      </PixelBox>
      {!data.connected && <div className="dim">Snowflake is offline, so these numbers are empty.</div>}
    </div>
  )
}
