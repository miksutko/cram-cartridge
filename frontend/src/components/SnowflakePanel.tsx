import type { Health, TraceEntry } from '../types'

interface Props {
  open: boolean
  health: Health | null
  traces: TraceEntry[]
  onClose: () => void
}

export function SnowflakePanel({ open, health, traces, onClose }: Props) {
  if (!open) return null
  return (
    <aside className="snowflake-panel" aria-label="Snowflake panel">
      <div className="panel-head">
        <h2>SNOWFLAKE</h2>
        <button type="button" className="btn small" onClick={onClose}>X</button>
      </div>
      <p className={health?.snowflake ? 'ok' : 'bad'}>
        {health === null
          ? 'Checking connection...'
          : health.snowflake
            ? `Connected · v${health.version}`
            : `Offline: ${health.error ?? 'unknown error'}`}
      </p>
      {traces.length === 0 && (
        <p className="muted">
          No Snowflake calls yet. Demo cartridges are built in; upload a PDF to watch Snowflake
          parse, chunk, embed and write your questions.
        </p>
      )}
      {traces.map((entry) => (
        <div key={entry.id} className="trace">
          <h3>{entry.label}</h3>
          <ul>
            {entry.steps.map((step, i) => (
              <li key={i} className={step.error ? 'bad' : undefined}>
                <span className="fn">{step.fn}</span>
                <span className="ms">{(step.ms / 1000).toFixed(1)}s</span>
                {step.error && <span className="err">{step.error}</span>}
              </li>
            ))}
          </ul>
          <p className="total">
            TOTAL {(entry.steps.reduce((sum, s) => sum + s.ms, 0) / 1000).toFixed(1)}s
          </p>
        </div>
      ))}
    </aside>
  )
}
