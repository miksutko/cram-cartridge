import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { api, errorText } from '../api/client'
import type { DeckSummary, UploadResult } from '../api/types'
import { Sprite } from '../art/Sprite'
import { Background } from '../components/Background'
import { Loading, PixelBox } from '../components/ui'
import { useKeys } from '../components/keys'
import { BIOMES, FORGE_CAPTIONS, LINES } from '../game/content'
import { sfx } from '../game/sfx'
import { load, save } from '../game/storage'
import type { BiomeId } from '../art/backgrounds'

interface Props {
  userId: string
  busy: boolean
  onPlay: (deck: DeckSummary) => void
  onBack: () => void
  onManual: () => void
}

const LOCAL_DECKS = 'cram-local-decks'
export const BESTS = 'cram-bests'

function rememberDeck(d: DeckSummary): void {
  const list = load<DeckSummary[]>(LOCAL_DECKS, [])
  save(LOCAL_DECKS, [d, ...list.filter((x) => x.deck_id !== d.deck_id)].slice(0, 20))
}

type Phase = { k: 'shelf' } | { k: 'form' } | { k: 'forging'; name: string } | { k: 'reveal'; res: UploadResult }

export function ShelfScreen({ userId, busy, onPlay, onBack, onManual }: Props) {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ k: 'shelf' })
  const [sel, setSel] = useState(0)
  const [fresh, setFresh] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const bests = load<Record<string, number>>(BESTS, {})

  useEffect(() => {
    let alive = true
    api
      .decks(userId)
      .then((res) => {
        if (!alive) return
        setDecks(res.decks)
        res.decks.forEach((d) => d.source !== 'demo' && d.source !== 'mock' && rememberDeck(d))
      })
      .catch((err) => {
        if (!alive) return
        // Fallback: the decks uploaded in this browser.
        setDecks(load<DeckSummary[]>(LOCAL_DECKS, []))
        setNote(`Shelf from this browser only (${errorText(err)})`)
      })
    return () => {
      alive = false
    }
  }, [userId, refresh])

  const count = (decks?.length ?? 0) + 1
  const pick = (i: number) => {
    if (busy || !decks) return
    sfx('confirm')
    if (i < decks.length) onPlay(decks[i])
    else setPhase({ k: 'form' })
  }
  useKeys(
    {
      ArrowLeft: () => setSel((s) => (s + count - 1) % count),
      a: () => setSel((s) => (s + count - 1) % count),
      ArrowRight: () => setSel((s) => (s + 1) % count),
      d: () => setSel((s) => (s + 1) % count),
      ArrowUp: () => setSel((s) => Math.max(0, s - 3)),
      ArrowDown: () => setSel((s) => Math.min(count - 1, s + 3)),
      Enter: () => pick(sel),
      ' ': () => pick(sel),
      Escape: onBack,
      h: onManual,
    },
    phase.k === 'shelf',
  )

  return (
    <div className="scr shelf">
      <Background biome="l1" still />
      <div className="shelf-wood" />
      <div className="scr-title">CARTRIDGE SHELF</div>
      {decks === null ? (
        <Loading text="Dusting off the shelf..." />
      ) : (
        <div className="shelf-row">
          {decks.map((d, i) => (
            <button
              type="button"
              key={d.deck_id}
              className={`cart ${sel === i ? 'sel' : ''} ${fresh === d.deck_id ? 'click-in' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => pick(i)}
              disabled={busy}
              title={d.name}
            >
              <Sprite id="cartridge" />
              <span className="cart-label">
                <span className="cart-topic">{d.main_topic}</span>
                <span className="cart-name">{d.name.replace(/^(Demo|Sample): /, '')}</span>
              </span>
              <span className="cart-meta">
                {d.source === 'demo' || d.source === 'mock' ? 'DEMO' : `${d.slides} SLIDES`}
                {bests[d.deck_id] ? ` · ★${bests[d.deck_id]}` : ''}
              </span>
            </button>
          ))}
          <button
            type="button"
            className={`cart empty ${sel === decks.length ? 'sel' : ''}`}
            onMouseEnter={() => setSel(decks.length)}
            onClick={() => pick(decks.length)}
          >
            <Sprite id="empty-slot" />
            <span className="cart-meta">{LINES.insert}</span>
          </button>
        </div>
      )}
      {decks && decks.length === 0 && <div className="shelf-empty">{LINES.emptyShelf}</div>}
      {decks && (
        <PixelBox className="shelf-detail">
          {sel < decks.length ? (
            <>
              <div className="msg-title">{decks[sel].name}</div>
              <div className="shelf-levels">
                {(decks[sel].subtopics ?? []).slice(0, 5).map((s, i) => (
                  <span key={s}>
                    LV{i + 1} {s}
                  </span>
                ))}
                <span>SUMMIT Retep</span>
              </div>
            </>
          ) : (
            <>
              <div className="msg-title">{LINES.insert}</div>
              <div className="dim">Upload a PDF of lecture slides to forge a new cartridge.</div>
            </>
          )}
        </PixelBox>
      )}
      <div className="hint-line bottom">◀ ▶ PICK · ENTER PLAY · H HOW TO PLAY · ESC BACK</div>
      {note && <div className="shelf-note">{note}</div>}

      {phase.k === 'form' && (
        <UploadForm
          error={uploadErr}
          onCancel={() => {
            setUploadErr(null)
            setPhase({ k: 'shelf' })
          }}
          onSubmit={(file, name) => {
            setUploadErr(null)
            setPhase({ k: 'forging', name })
            api
              .upload(file, name)
              .then((res) => {
                sfx('levelUp')
                setPhase({ k: 'reveal', res })
              })
              .catch((err) => {
                setUploadErr(errorText(err))
                setPhase({ k: 'form' })
              })
          }}
        />
      )}
      {phase.k === 'forging' && <Forge name={phase.name} />}
      {phase.k === 'reveal' && (
        <Reveal
          res={phase.res}
          onDone={() => {
            const d: DeckSummary = {
              deck_id: phase.res.deck_id,
              name: phase.res.name,
              main_topic: phase.res.main_topic,
              source: 'local',
              subtopics: phase.res.subtopics.map((s) => s.name),
              slides: phase.res.slides,
            }
            rememberDeck(d)
            setFresh(d.deck_id)
            setPhase({ k: 'shelf' })
            setRefresh((n) => n + 1)
            sfx('confirm')
          }}
        />
      )}
    </div>
  )
}

function UploadForm({ error, onCancel, onSubmit }: { error: string | null; onCancel: () => void; onSubmit: (file: File, name: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [localErr, setErr] = useState<string | null>(null)
  const err = localErr ?? error
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useKeys({ Escape: onCancel })

  const choose = (f: File | null | undefined) => {
    if (!f) return
    setFile(f)
    setErr(null)
    if (!name) setName(f.name.replace(/\.pdf$/i, '').slice(0, 40))
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!file) return setErr('Pick a PDF of your lecture slides.')
    if (!name.trim()) return setErr('Give the cartridge a name.')
    onSubmit(file, name.trim())
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    choose(e.dataTransfer.files?.[0])
  }
  return (
    <div className="overlay">
      <PixelBox className="upload-box">
        <form onSubmit={submit}>
          <div className="msg-title">{LINES.insert}</div>
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={drop}
            onClick={() => input.current?.click()}
          >
            {file ? `📜 ${file.name}` : 'DROP YOUR SLIDES (PDF) HERE OR CLICK'}
            <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => choose(e.target.files?.[0])} />
          </div>
          <label className="field">
            NAME
            <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Week 5: Recursion" autoFocus />
          </label>
          {err && <div className="form-err">{LINES.dusty}: {err}</div>}
          <div className="row">
            <button type="button" className="pbtn ghost" onClick={onCancel}>
              BACK
            </button>
            <button type="submit" className="pbtn">
              FORGE ▶
            </button>
          </div>
        </form>
      </PixelBox>
    </div>
  )
}

function Forge({ name }: { name: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((k) => (k + 1) % FORGE_CAPTIONS.length), 2200)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="overlay forge">
      <div className="forge-title">FORGING THE MAP</div>
      <div className="forge-name">“{name}”</div>
      <div className="forge-anvil">
        <div className="forge-slide" />
        <div className="forge-sparks">
          {Array.from({ length: 10 }, (_, k) => (
            <span key={k} style={{ animationDelay: `${k * 90}ms`, left: `${8 + k * 5}px` }} />
          ))}
        </div>
        <div className="forge-mountain">
          {(['l1', 'l2', 'l3', 'l4', 'l5', 'summit'] as BiomeId[]).map((b, k) => (
            <span key={b} style={{ background: BIOMES[b].colors[1], animationDelay: `${k * 400}ms`, width: `${72 - k * 12}px` }} />
          ))}
        </div>
      </div>
      <div className="forge-caption">{FORGE_CAPTIONS[i]}</div>
    </div>
  )
}

function Reveal({ res, onDone }: { res: UploadResult; onDone: () => void }) {
  useKeys({ Enter: onDone, ' ': onDone, Escape: onDone })
  const levels = res.subtopics.slice(0, 5)
  const ids: BiomeId[] = ['l1', 'l2', 'l3', 'l4', 'l5']
  return (
    <div className="overlay">
      <PixelBox className="reveal-box">
        <div className="msg-title">A NEW CARTRIDGE!</div>
        <div className="reveal-topic">{res.main_topic}</div>
        <div className="reveal-meta">{res.slides} SLIDES · {levels.length} LEVELS + THE SUMMIT</div>
        <ol className="reveal-levels">
          <li style={{ borderColor: BIOMES.summit.colors[2] }}>SUMMIT · Retep</li>
          {levels
            .map((s, k) => (
              <li key={s.subtopic_no} style={{ borderColor: BIOMES[ids[k]].colors[2], background: BIOMES[ids[k]].colors[0] }}>
                LV{k + 1} · {s.name}
              </li>
            ))
            .reverse()}
        </ol>
        <button type="button" className="pbtn" onClick={onDone} autoFocus>
          PUT IT ON THE SHELF ▶
        </button>
      </PixelBox>
    </div>
  )
}
