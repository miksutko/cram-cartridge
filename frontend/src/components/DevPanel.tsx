import { useState } from 'react'
import { backendMode, healthStore } from '../api/client'
import { devMode, lastResponse, traceLog } from '../game/dev'
import { LINES } from '../game/content'
import { useStore } from '../game/store'

/** Dev mode only: the console's "debug port". Shows only what the server sends. */
export function DevPanel() {
  const on = useStore(devMode)
  const traces = useStore(traceLog)
  const last = useStore(lastResponse)
  const mode = useStore(backendMode)
  const health = useStore(healthStore)
  const [open, setOpen] = useState(true)
  const [raw, setRaw] = useState(false)
  if (!on) return null
  return (
    <>
      <div className="dev-tag">DEV</div>
      <button type="button" className="dev-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '◀ DEBUG PORT' : '▶ DEBUG PORT'}
      </button>
      {open && (
        <aside className="dev-panel" aria-label="Debug port">
          <div className="dev-head">
            <b>DEBUG PORT</b>
            <span>
              backend: <b className={mode === 'real' ? 'ok' : 'warn'}>{mode.toUpperCase()}</b>
            </span>
            <span>
              snowflake:{' '}
              <b className={health?.snowflake ? 'ok' : 'bad'}>{health?.snowflake ? `ON ${health.version ?? ''}` : 'OFF'}</b>
            </span>
            {health?.error && <span className="dev-err">{health.error}</span>}
          </div>
          <div className="dev-section">TRACE (newest first)</div>
          {traces.length === 0 && <div className="dev-empty">Nothing yet: upload a cartridge or enter a node.</div>}
          {traces.map((t) => (
            <div className="dev-trace" key={t.id}>
              <div className="dev-trace-label">
                {t.label} <span className="dim">{new Date(t.at).toLocaleTimeString()}</span>
              </div>
              {!t.steps || t.steps.length === 0 ? (
                <div className="dev-empty">{LINES.noTrace}</div>
              ) : (
                <table>
                  <tbody>
                    {t.steps.map((s, i) => (
                      <tr key={i} className={s.error ? 'bad' : ''}>
                        <td>{s.fn}</td>
                        <td className="num">{s.ms} ms</td>
                        <td className="num">{s.rows} rows</td>
                        {s.error && <td className="dev-err">{s.error}</td>}
                        {s.detail !== undefined && <td className="dim">{JSON.stringify(s.detail).slice(0, 160)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          <button type="button" className="dev-section dev-raw-toggle" onClick={() => setRaw((r) => !r)}>
            {raw ? '▼' : '▶'} LAST RESPONSE {last ? `(${last.path})` : ''}
          </button>
          {raw && <pre className="dev-raw">{last ? JSON.stringify(last.body, null, 2) : 'none yet'}</pre>}
        </aside>
      )}
    </>
  )
}
