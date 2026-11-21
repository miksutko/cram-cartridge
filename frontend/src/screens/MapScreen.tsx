import { useEffect, useState } from 'react'
import { api } from '../api'
import type { MapNode, RunMap } from '../types'

interface Props {
  runId: string
  onEnter: (nodeId: string) => void
  onShelf: () => void
}

// Node positions on the 240x160 mountain, bottom (level 1) to top (summit).
const SPOTS = [
  [80, 136],
  [156, 112],
  [92, 88],
  [146, 66],
  [104, 46],
]
const SUMMIT_SPOT = [120, 20]
const BANDS = [
  { y: 124, h: 30, fill: '#3a2c48' },
  { y: 100, h: 24, fill: '#1b4965' },
  { y: 76, h: 24, fill: '#3a5a40' },
  { y: 54, h: 22, fill: '#e9f2f9' },
  { y: 34, h: 20, fill: '#b5361a' },
  { y: 0, h: 34, fill: '#ffffff' },
]
const STATUS_FILL = { cleared: '#4ade80', open: '#ffd166', locked: '#5c5c70' }

function spot(node: MapNode, index: number) {
  return node.level === 'summit' ? SUMMIT_SPOT : SPOTS[Math.min(index, SPOTS.length - 1)]
}

function Mountain({ nodes }: { nodes: MapNode[] }) {
  const points = nodes.map((n, i) => spot(n, i))
  return (
    <svg className="scene" viewBox="0 0 240 160" shapeRendering="crispEdges" role="img" aria-label="Mountain map">
      <rect width="240" height="160" fill="#6ec6ee" />
      <clipPath id="mountain">
        <polygon points="6,154 120,8 234,154" />
      </clipPath>
      <g clipPath="url(#mountain)">
        {BANDS.map((b) => (
          <rect key={b.y} x="0" y={b.y} width="240" height={b.h} fill={b.fill} />
        ))}
      </g>
      <rect y="154" width="240" height="6" fill="#2a2033" />
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(' ')}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      {nodes.map((n, i) => {
        const [x, y] = points[i]
        return (
          <g key={n.node_id} className={n.status === 'open' ? 'blink' : undefined}>
            <rect x={x - 7} y={y - 7} width="14" height="14" fill="#0f0f1b" />
            <rect x={x - 5} y={y - 5} width="10" height="10" fill={STATUS_FILL[n.status]} />
          </g>
        )
      })}
    </svg>
  )
}

export function MapScreen({ runId, onEnter, onShelf }: Props) {
  const [run, setRun] = useState<RunMap | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .map(runId)
      .then((res) => {
        if (alive) setRun(res)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [runId])

  if (error) return <section className="screen"><p className="bad">{error}</p></section>
  if (!run) return <section className="screen"><p className="muted blink">Loading map...</p></section>

  const current = run.map.find((n) => n.node_id === run.current_node_id)
  return (
    <section className="screen map">
      <div className="map-head">
        <h1>{run.main_topic.toUpperCase()}</h1>
        <span className="hearts">
          HP {'■'.repeat(run.hp)}
          <span className="lost">{'■'.repeat(run.max_hp - run.hp)}</span>
        </span>
      </div>
      <div className="scene-wrap">
        <Mountain nodes={run.map} />
      </div>
      <ol className="levels" reversed>
        {[...run.map].reverse().map((n) => (
          <li key={n.node_id} className={n.status}>
            <span className="lvl">{n.level === 'summit' ? 'SUMMIT' : `LV ${n.level}`}</span>
            <span className="lvl-name">
              {n.biome} · {n.enemy}
            </span>
            <span className="lvl-sub">{n.kind === 'boss' ? 'whole topic + other lecture' : n.subtopic}</span>
            <span className="lvl-status">{n.status === 'cleared' ? 'CLEARED' : n.status === 'open' ? 'NEXT' : '...'}</span>
          </li>
        ))}
      </ol>
      <div className="row">
        {current && (
          <button type="button" className="btn big" onClick={() => onEnter(current.node_id)} autoFocus>
            FIGHT THE {current.enemy.toUpperCase()} ▶
          </button>
        )}
        <button type="button" className="btn" onClick={onShelf}>
          SHELF
        </button>
      </div>
    </section>
  )
}
