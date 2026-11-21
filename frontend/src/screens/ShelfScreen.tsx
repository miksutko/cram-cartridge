import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { DeckSummary, Health, TraceStep, UploadResult } from '../types'

interface Props {
  health: Health | null
  busyDeck: string | null
  onPlay: (deck: DeckSummary) => void
  onTrace: (label: string, steps: TraceStep[]) => void
}

export function ShelfScreen({ health, busyDeck, onPlay, onTrace }: Props) {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [shelfError, setShelfError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<UploadResult | null>(null)

  useEffect(() => {
    let alive = true
    api
      .decks()
      .then((res) => {
        if (alive) setDecks(res.decks)
      })
      .catch((err: Error) => {
        if (alive) setShelfError(err.message)
      })
    return () => {
      alive = false
    }
  }, [refresh])

  const canUpload = health?.snowflake === true

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!file || !name.trim()) return
    setUploading(true)
    setUploadError(null)
    setUploaded(null)
    api
      .upload(file, name.trim())
      .then((res) => {
        setUploaded(res)
        onTrace(`Upload: ${res.name}`, res.trace)
        setRefresh((n) => n + 1)
        setFile(null)
        setName('')
      })
      .catch((err: Error) => setUploadError(err.message))
      .finally(() => setUploading(false))
  }

  return (
    <section className="screen shelf">
      <h1>CARTRIDGE SHELF</h1>
      <p className="muted">Pick a cartridge to start the climb.</p>

      {shelfError && <p className="bad">Could not load the shelf: {shelfError}</p>}
      {decks === null && !shelfError && <p className="muted blink">Loading...</p>}

      <div className="cartridges">
        {decks?.map((deck) => (
          <button
            type="button"
            key={deck.deck_id}
            className={`cartridge ${deck.source}`}
            onClick={() => onPlay(deck)}
            disabled={busyDeck !== null}
          >
            <span className="cart-label">
              <span className="cart-tag">{deck.source === 'demo' ? 'DEMO' : 'SNOWFLAKE'}</span>
              <span className="cart-name">{deck.main_topic}</span>
              <span className="cart-sub">{deck.name}</span>
              {deck.subtopics && (
                <span className="cart-levels">{Math.min(deck.subtopics.length, 3)} LEVELS + SUMMIT</span>
              )}
            </span>
            <span className="cart-cta">{busyDeck === deck.deck_id ? 'LOADING...' : 'PLAY ▶'}</span>
          </button>
        ))}

        <form className="cartridge upload" onSubmit={submit}>
          <span className="cart-label">
            <span className="cart-tag">NEW</span>
            <span className="cart-name">Burn a cartridge</span>
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                maxLength={80}
                placeholder="Week 5 lecture"
                onChange={(e) => setName(e.target.value)}
                disabled={!canUpload || uploading}
              />
            </label>
            <label className="field">
              <span>Lecture PDF</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={!canUpload || uploading}
              />
            </label>
          </span>
          <button type="submit" className="btn" disabled={!canUpload || uploading || !file || !name.trim()}>
            {uploading ? 'SNOWFLAKE IS READING...' : 'UPLOAD'}
          </button>
          {!canUpload && (
            <span className="muted small">
              {health === null ? 'Checking Snowflake...' : 'Upload needs Snowflake (fill in .env).'}
            </span>
          )}
          {uploading && <span className="muted small blink">Parsing, chunking and embedding. This can take a minute.</span>}
          {uploadError && <span className="bad small">{uploadError}</span>}
        </form>
      </div>

      {uploaded && (
        <div className="upload-result">
          <h2>NEW CARTRIDGE: {uploaded.main_topic}</h2>
          <p>
            {uploaded.slides} slides · {uploaded.chunks} chunks
          </p>
          <ol>
            {uploaded.subtopics.map((s) => (
              <li key={s.subtopic_no}>
                {s.name} <span className="muted">({s.chunks} chunks, {s.questions} questions)</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
