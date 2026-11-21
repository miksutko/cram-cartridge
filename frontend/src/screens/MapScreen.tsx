import { useEffect, useMemo, useRef, useState } from 'react'
import type { RunCtx } from '../App'
import { api, errorText } from '../api/client'
import type { MapNode, RunMap, RunOver } from '../api/types'
import { biomeOf } from '../art/backgrounds'
import { Sprite } from '../art/Sprite'
import { Hearts, Loading, MessageBox, PixelBox, Typewriter } from '../components/ui'
import { useKeys } from '../components/keys'
import { BIOMES, enemyName, itemInfo, LINES, NODE_INFO } from '../game/content'
import { sfx } from '../game/sfx'

interface Props {
  run: RunCtx
  onEnter: (nodeId: string, kind: string) => void
  onShelf: () => void
  onRunOver: (r: RunOver) => void
}

const STEP = 30
const PAD_TOP = 44
const PAD_BOTTOM = 76
const MAP_W = 240

const lastSeen = new Map<string, string>()

interface Placed {
  node: MapNode
  x: number
  y: number
}

function layout(nodes: MapNode[]): { placed: Placed[]; height: number } {
  const height = PAD_TOP + PAD_BOTTOM + Math.max(0, nodes.length - 1) * STEP
  const placed = nodes.map((node, i) => {
    const y = height - PAD_BOTTOM - i * STEP
    const isTop = node.level === 'summit'
    const x = isTop ? MAP_W / 2 : MAP_W / 2 + Math.round(Math.sin(i * 1.3) * (34 - i * 0.6))
    return { node, x, y }
  })
  return { placed, height }
}

function drawMountain(c: HTMLCanvasElement, placed: Placed[], height: number): void {
  c.width = MAP_W
  c.height = height
  const ctx = c.getContext('2d')
  if (!ctx) return
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  // sky
  for (let y = 0; y < height; y++) {
    const t = y / height
    ctx.fillStyle = t < 0.5 ? '#3a4058' : '#22263a'
    ctx.fillRect(0, y, MAP_W, 1)
  }
  // band for each row = the level of the nearest node
  const levelAt = (y: number) => {
    let best = placed[0]
    for (const p of placed) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p
    return best?.node.level ?? 1
  }
  const peak = 14
  for (let y = peak; y < height; y++) {
    const half = Math.min(MAP_W / 2 + 10, 12 + (y - peak) * 0.9)
    const info = BIOMES[biomeOf(levelAt(y))]
    const nextInfo = BIOMES[biomeOf(levelAt(y - 6))]
    for (let x = Math.floor(MAP_W / 2 - half); x < MAP_W / 2 + half; x++) {
      const edge = x < MAP_W / 2 - half + 2 || x > MAP_W / 2 + half - 3
      const blend = nextInfo !== info && bayer[(y & 3) * 4 + (x & 3)] < 8
      const col = edge ? info.colors[0] : blend ? nextInfo.colors[1] : x < MAP_W / 2 - half / 3 ? info.colors[1] : info.colors[0]
      ctx.fillStyle = col
      ctx.fillRect(x, y, 1, 1)
    }
  }
  // snow/cloud cap
  ctx.fillStyle = '#e8eef8'
  for (let y = peak; y < peak + 8; y++) {
    const half = 12 + (y - peak) * 0.9
    for (let x = Math.floor(MAP_W / 2 - half); x < MAP_W / 2 + half; x++) if ((x + y) % 3 !== 0) ctx.fillRect(x, y, 1, 1)
  }
  // dotted paths
  const byId = new Map(placed.map((p) => [p.node.node_id, p]))
  placed.forEach((p, i) => {
    const targets = p.node.next ? p.node.next.map((id) => byId.get(id)).filter(Boolean) : [placed[i + 1]].filter(Boolean)
    for (const q of targets as Placed[]) {
      const n = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y))
      for (let k = 0; k <= n; k += 3) {
        const x = Math.round(p.x + ((q.x - p.x) * k) / n)
        const y = Math.round(p.y + ((q.y - p.y) * k) / n)
        ctx.fillStyle = p.node.status === 'cleared' ? '#f8d020' : '#d8d0c0'
        ctx.fillRect(x, y, 2, 2)
        ctx.fillStyle = '#1a1410'
        ctx.fillRect(x + 1, y + 2, 1, 1)
      }
    }
  })
}

export function MapScreen({ run, onEnter, onShelf, onRunOver }: Props) {
  const [map, setMap] = useState<RunMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [markerAt, setMarkerAt] = useState<string | null>(lastSeen.get(run.runId) ?? null)

  useEffect(() => {
    let alive = true
    api
      .map(run.runId)
      .then((m) => alive && setMap(m))
      .catch((err) => alive && setError(errorText(err)))
    return () => {
      alive = false
    }
  }, [run.runId])

  const { placed, height } = useMemo(() => layout(map?.map ?? []), [map])
  const current = placed.find((p) => p.node.node_id === map?.current_node_id) ?? null

  useEffect(() => {
    if (canvas.current && placed.length) drawMountain(canvas.current, placed, height)
  }, [placed, height])

  // Animate the marker from the last node to the one the server picked, and follow it.
  useEffect(() => {
    if (!current) return
    const id = window.setTimeout(() => {
      setMarkerAt(current.node.node_id)
      lastSeen.set(run.runId, current.node.node_id)
    }, 350)
    return () => window.clearTimeout(id)
  }, [current, run.runId])
  const marker = placed.find((p) => p.node.node_id === markerAt) ?? current
  useEffect(() => {
    const el = scroller.current
    if (el && marker) el.scrollTo({ top: Math.max(0, marker.y - 70), behavior: 'smooth' })
  }, [marker])

  const enter = () => {
    if (!current || !map || map.run_status !== 'active') return
    sfx('confirm')
    onEnter(current.node.node_id, current.node.kind)
  }
  useKeys({ Enter: enter, ' ': enter, Escape: onShelf })

  if (error) return <MessageBox title={LINES.dusty} text={error} onClose={onShelf} />
  if (!map) return <Loading text={LINES.loading} />

  if (map.run_status !== 'active' && !current) {
    return (
      <MessageBox
        title={map.run_status === 'won' ? LINES.victory : LINES.defeat}
        text="This climb is over."
        action="SHELF"
        onClose={() =>
          onRunOver({ won: map.run_status === 'won', score: map.score ?? 0, best_score: 0, answered: 0, correct: 0, accuracy: 0, time_s: 0, hp_left: map.hp, weak_spots: [] })
        }
      />
    )
  }

  const info = current ? NODE_INFO[current.node.kind] : null
  const biome = current ? BIOMES[biomeOf(current.node.level)] : null
  return (
    <div className="scr map">
      <div className="map-scroll" ref={scroller}>
        <div className="map-inner" style={{ height }}>
          <canvas ref={canvas} className="map-canvas" />
          {placed.map((p) => {
            const ni = NODE_INFO[p.node.kind] ?? NODE_INFO.enemy
            const icon = p.node.status === 'cleared' ? 'node-cleared' : p.node.status === 'locked' ? (p.node.kind === 'boss' ? 'node-boss' : ni.icon) : ni.icon
            return (
              <div
                key={p.node.node_id}
                className={`map-node ${p.node.status} ${p.node.node_id === current?.node.node_id ? 'current' : ''}`}
                style={{ left: p.x - 8, top: p.y - 8 }}
                title={`${ni.label}${p.node.subtopic ? ` · ${p.node.subtopic}` : ''}`}
                onClick={() => p.node.node_id === current?.node.node_id && enter()}
              >
                <Sprite id={icon} />
                {p.node.status === 'locked' && <span className="lock-dot" />}
              </div>
            )
          })}
          {marker && (
            <div className="map-marker" style={{ left: marker.x - 8, top: marker.y - 26 }}>
              <Sprite id="node-current" />
            </div>
          )}
        </div>
      </div>
      <div className="map-hud">
        <Hearts hp={map.hp} max={map.max_hp} />
        <span className="map-items">
          {map.items.map((it) => (
            <span key={it.item_id} className="item-chip" title={itemInfo(it.item_id, it.name).name}>
              <Sprite id={itemInfo(it.item_id, it.name).icon} />
              {it.count && it.count > 1 ? `×${it.count}` : ''}
            </span>
          ))}
        </span>
        <span className="map-topic">{map.main_topic}</span>
      </div>
      {map.reason && (
        <div className="map-reason">
          <Typewriter text={map.reason} />
        </div>
      )}
      {current && info && biome && (
        <PixelBox className="map-info">
          <div className="map-info-title">
            <Sprite id={info.icon} /> {current.node.kind === 'treasure' ? 'TREASURE TROVE' : current.node.kind === 'boss' ? 'RETEP, THE FINAL STORM' : `${info.label.toUpperCase()}: ${enemyName(current.node.enemy)}`}
          </div>
          <div className="map-info-sub">
            {biome.name}
            {current.node.subtopic && current.node.kind !== 'treasure' ? ` · ${current.node.subtopic}` : ''}
          </div>
          <div className="map-info-cta blink">ENTER ▶</div>
        </PixelBox>
      )}
    </div>
  )
}
