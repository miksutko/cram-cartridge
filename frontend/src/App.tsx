import { useCallback, useEffect, useState } from 'react'
import { api, getUserId } from './api'
import { SnowflakePanel } from './components/SnowflakePanel'
import { FightScreen } from './screens/FightScreen'
import { MapScreen } from './screens/MapScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { ShelfScreen } from './screens/ShelfScreen'
import { StartScreen } from './screens/StartScreen'
import type { DeckSummary, Health, RunOver, TraceEntry, TraceStep } from './types'

type Screen =
  | { name: 'start' }
  | { name: 'shelf' }
  | { name: 'map'; runId: string }
  | { name: 'fight'; runId: string; nodeId: string }
  | { name: 'results'; runId: string; result: RunOver }

const userId = getUserId()

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' })
  const [deck, setDeck] = useState<DeckSummary | null>(null)
  const [busyDeck, setBusyDeck] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [traces, setTraces] = useState<TraceEntry[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .health()
      .then((h) => {
        if (alive) setHealth(h)
      })
      .catch(() => {
        if (alive) setHealth({ ok: false, snowflake: false, error: 'backend offline' })
      })
    return () => {
      alive = false
    }
  }, [])

  const addTrace = useCallback((label: string, steps: TraceStep[]) => {
    setTraces((list) => [{ id: Date.now(), label, steps }, ...list].slice(0, 20))
  }, [])

  function play(chosen: DeckSummary) {
    setBusyDeck(chosen.deck_id)
    setError(null)
    api
      .startRun(userId, chosen.deck_id)
      .then((run) => {
        setDeck(chosen)
        setScreen({ name: 'map', runId: run.run_id })
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusyDeck(null))
  }

  const toShelf = () => setScreen({ name: 'shelf' })

  let body
  switch (screen.name) {
    case 'start':
      body = <StartScreen onStart={toShelf} />
      break
    case 'shelf':
      body = <ShelfScreen health={health} busyDeck={busyDeck} onPlay={play} onTrace={addTrace} />
      break
    case 'map':
      body = (
        <MapScreen
          runId={screen.runId}
          onEnter={(nodeId) => setScreen({ name: 'fight', runId: screen.runId, nodeId })}
          onShelf={toShelf}
        />
      )
      break
    case 'fight':
      body = (
        <FightScreen
          key={`${screen.runId}-${screen.nodeId}`}
          userId={userId}
          runId={screen.runId}
          nodeId={screen.nodeId}
          onTrace={addTrace}
          onCleared={() => setScreen({ name: 'map', runId: screen.runId })}
          onRunOver={(result) => setScreen({ name: 'results', runId: screen.runId, result })}
        />
      )
      break
    case 'results':
      body = (
        <ResultsScreen
          userId={userId}
          deckId={deck?.deck_id ?? ''}
          deckName={deck?.name ?? ''}
          result={screen.result}
          onReplay={() => deck && play(deck)}
          onShelf={toShelf}
        />
      )
      break
  }

  const status = health === null ? 'checking' : health.snowflake ? 'on' : health.ok ? 'off' : 'down'
  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="logo" onClick={() => setScreen({ name: 'start' })}>
          CRAM CARTRIDGE
        </button>
        <span className="alpha">ALPHA</span>
        <button type="button" className={`sf-status ${status}`} onClick={() => setPanelOpen((o) => !o)}>
          ❄ SNOWFLAKE {status === 'on' ? 'ON' : status === 'checking' ? '...' : status === 'down' ? 'NO BACKEND' : 'OFF'}
        </button>
      </header>
      {error && <p className="bad banner">{error}</p>}
      <main>{body}</main>
      <SnowflakePanel open={panelOpen} health={health} traces={traces} onClose={() => setPanelOpen(false)} />
    </div>
  )
}

export default App
