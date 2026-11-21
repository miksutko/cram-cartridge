import { useCallback, useEffect, useRef, useState } from 'react'
import { api, backendMode, errorText, initBackend, reconnect } from './api/client'
import type { DeckSummary, Level, Report, RunOver } from './api/types'
import { ConsoleFrame } from './components/ConsoleFrame'
import { DevPanel } from './components/DevPanel'
import { Loading, MessageBox } from './components/ui'
import { LINES } from './game/content'
import { playMusic, unlockMusic } from './game/music'
import { playerName, settings } from './game/settings'
import { getUserId } from './game/storage'
import { useStore } from './game/store'
import { Gallery } from './screens/Gallery'
import { Manual } from './screens/Manual'
import { MapScreen } from './screens/MapScreen'
import { NodeScreen } from './screens/NodeScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ShelfScreen } from './screens/ShelfScreen'
import { StartScreen } from './screens/StartScreen'
import { NameScreen } from './screens/NameScreen'

export type Screen =
  | { name: 'start'; attract?: boolean }
  | { name: 'name'; then: 'shelf' | 'settings' }
  | { name: 'shelf' }
  | { name: 'map' }
  | { name: 'node'; nodeId: string; kind: string }
  | { name: 'results'; result: RunOver }
  | { name: 'manual'; back: Screen }
  | { name: 'settings'; back: Screen }
  | { name: 'gallery' }

/** What the client remembers about the current run (the server owns the real state). */
export interface RunCtx {
  runId: string
  deck: DeckSummary
  before: Report | null
  quotesSeen: number
  bosses: string[]
  lastLevel: Level | null
  started: number
}

const userId = getUserId()

/** Screens that need no run can be opened straight from the hash (e.g. #/manual). */
function screenFromHash(): Screen {
  switch (window.location.hash) {
    case '#/gallery':
      return { name: 'gallery' }
    case '#/start':
      return { name: 'start' }
    case '#/name':
      return { name: 'name', then: 'shelf' }
    case '#/shelf':
      return { name: 'shelf' }
    case '#/manual':
      return { name: 'manual', back: { name: 'start' } }
    case '#/settings':
      return { name: 'settings', back: { name: 'start' } }
    default:
      return { name: 'start', attract: true }
  }
}

export default function App() {
  const [screen, setScreenState] = useState<Screen>(screenFromHash)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<RunCtx | null>(null)
  const [busy, setBusy] = useState(false)
  const mode = useStore(backendMode)
  useStore(settings)
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  }, [run])

  const go = useCallback((s: Screen) => {
    setScreenState(s)
    const hash = `#/${s.name}`
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }, [])

  useEffect(() => {
    initBackend().finally(() => setReady(true))
    const onHash = () => {
      if (window.location.hash === '#/gallery') setScreenState({ name: 'gallery' })
    }
    window.addEventListener('hashchange', onHash)
    const unlock = () => unlockMusic()
    window.addEventListener('keydown', unlock, { once: true })
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])

  // On run-free screens, keep trying to leave the fallback mock for the real backend.
  const runFree = ['start', 'name', 'shelf', 'manual', 'settings'].includes(screen.name)
  useEffect(() => {
    if (mode !== 'mock' || !runFree) return
    const id = window.setInterval(() => void reconnect(), 5000)
    return () => window.clearInterval(id)
  }, [mode, runFree])

  useEffect(() => {
    const slot =
      screen.name === 'start' || screen.name === 'name' || screen.name === 'manual' || screen.name === 'settings'
        ? 'title'
        : screen.name === 'shelf'
          ? 'shelf'
          : screen.name === 'map'
            ? 'map'
            : screen.name === 'results'
              ? screen.result.won
                ? 'victory'
                : 'defeat'
              : null
    if (slot) playMusic(slot)
  }, [screen])

  const startRun = useCallback(
    async (deck: DeckSummary) => {
      if (busy) return
      setBusy(true)
      setError(null)
      try {
        // the report before this run (for the ledger's "since last climb") loads alongside
        const [before, map] = await Promise.all([api.report(userId).catch(() => null), api.startRun(userId, deck.deck_id, playerName())])
        setRun({ runId: map.run_id, deck, before, quotesSeen: 0, bosses: [], lastLevel: null, started: Date.now() })
        go({ name: 'map' })
      } catch (err) {
        setError(errorText(err))
      } finally {
        setBusy(false)
      }
    },
    [busy, go],
  )

  const startPressed = useCallback(() => {
    if (settings.get().name === null) go({ name: 'name', then: 'shelf' })
    else go({ name: 'shelf' })
  }, [go])

  if (screen.name === 'gallery') return <Gallery onBack={() => go({ name: 'start' })} />

  let body = null
  if (!ready) body = <Loading text={LINES.loading} />
  else
    switch (screen.name) {
      case 'start':
        body = (
          <StartScreen
            attract={screen.attract ?? false}
            onStart={startPressed}
            onManual={() => go({ name: 'manual', back: { name: 'start' } })}
            onSettings={() => go({ name: 'settings', back: { name: 'start' } })}
          />
        )
        break
      case 'name':
        body = (
          <NameScreen
            onDone={() => go(screen.then === 'shelf' ? { name: 'shelf' } : { name: 'settings', back: { name: 'start' } })}
            onBack={() => go(screen.then === 'shelf' ? { name: 'start' } : { name: 'settings', back: { name: 'start' } })}
          />
        )
        break
      case 'shelf':
        body = <ShelfScreen userId={userId} busy={busy} onPlay={startRun} onBack={() => go({ name: 'start' })} onManual={() => go({ name: 'manual', back: { name: 'shelf' } })} />
        break
      case 'map':
        body = run ? (
          <MapScreen
            run={run}
            onEnter={(nodeId, kind) => go({ name: 'node', nodeId, kind })}
            onShelf={() => go({ name: 'shelf' })}
            onRunOver={(result) => go({ name: 'results', result })}
          />
        ) : null
        break
      case 'node':
        body = run ? (
          <NodeScreen
            key={screen.nodeId}
            userId={userId}
            run={run}
            nodeId={screen.nodeId}
            setRun={setRun}
            onDone={() => go({ name: 'map' })}
            onRunOver={(result) => go({ name: 'results', result })}
          />
        ) : null
        break
      case 'results':
        body = run ? (
          <ResultsScreen userId={userId} run={run} result={screen.result} onReplay={() => startRun(run.deck)} onShelf={() => go({ name: 'shelf' })} />
        ) : null
        break
      case 'manual':
        body = <Manual onBack={() => go(screen.back)} />
        break
      case 'settings':
        body = <SettingsScreen onBack={() => go(screen.back)} onChangeName={() => go({ name: 'name', then: 'settings' })} />
        break
    }

  if (body === null) body = <MessageBox title="LOST ON THE MOUNTAIN" text="That run is gone. Back to the shelf!" onClose={() => go({ name: 'shelf' })} />

  return (
    <div className="app">
      <ConsoleFrame badges={mode === 'mock' ? <div className="mock-badge">MOCK DATA</div> : null}>
        <div className="screen-anim" key={screen.name === 'node' ? `node-${screen.nodeId}` : screen.name}>
          {body}
        </div>
        {error && <MessageBox title={LINES.dusty} text={error} onClose={() => setError(null)} />}
        {busy && (
          <div className="overlay">
            <Loading text={LINES.loading} />
          </div>
        )}
      </ConsoleFrame>
      <DevPanel />
    </div>
  )
}
