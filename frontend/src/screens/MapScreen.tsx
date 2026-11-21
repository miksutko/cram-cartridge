import { useEffect, useMemo, useRef, useState } from 'react'
import type { RunCtx } from '../App'
import { api, errorText } from '../api/client'
import type { MapNode, RunMap, RunOver } from '../api/types'
import { biomeOf } from '../art/backgrounds'
import { rng } from '../art/pixel'
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
    const x = isTop ? MAP_W / 2 : MAP_W / 2 + Math.round(Math.sin(i * 1.3) * Math.min(40, 10 + (y / height) * 40))
    return { node, x, y }
  })
  return { placed, height }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const dither = (x: number, y: number, t: number) => t * 16 > BAYER[(y & 3) * 4 + (x & 3)]

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

/** A pixel mountain: sky, side peaks, a jagged lit/shaded massif banded by biome, snow cap and trees. */
function drawMountain(c: HTMLCanvasElement, placed: Placed[], height: number): void {
  c.width = MAP_W
  c.height = height
  const ctx = c.getContext('2d')
  if (!ctx) return
  const px = (x: number, y: number, col: string) => {
    ctx.fillStyle = col
    ctx.fillRect(x, y, 1, 1)
  }
  const rand = rng(97)
  // sky: deep blue at the top to a pale dawn near the base, dithered
  const sky = ['#1e2458', '#2e3a7a', '#4a5a9e', '#7a86c0', '#b8b0d0', '#f0c8a8']
  for (let y = 0; y < height; y++) {
    const t = (y / height) * (sky.length - 1)
    const i = Math.min(sky.length - 2, Math.floor(t))
    for (let x = 0; x < MAP_W; x++) px(x, y, dither(x, y, t - i) ? sky[i + 1] : sky[i])
  }
  // stars high up, clouds lower
  for (let i = 0; i < 40; i++) px(Math.floor(rand() * MAP_W), Math.floor(rand() * height * 0.35), '#e8e8ff')
  for (let i = 0; i < 7; i++) {
    const cx = rand() * MAP_W
    const cy = height * (0.25 + rand() * 0.6)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(Math.round(cx), Math.round(cy), 36, 4)
    ctx.fillRect(Math.round(cx) + 6, Math.round(cy) - 3, 22, 3)
  }
  const peakY = 18
  const base = height
  const slope = (MAP_W / 2 + 20) / (base - peakY)
  // side peaks for scale
  for (const [cx, top, col] of [[20, height * 0.45, '#3a3466'], [222, height * 0.38, '#34305e']] as [number, number, string][]) {
    for (let y = Math.floor(top); y < base; y++) {
      const half = (y - top) * 0.9
      for (let x = Math.floor(cx - half); x < cx + half; x++) if (x >= 0 && x < MAP_W) px(x, y, dither(x, y, 0.5) && y < top + 6 ? '#e8e8f8' : col)
    }
  }
  // which level owns each row: the nearest node
  const levelAt = (y: number) => {
    let best = placed[0]
    for (const p of placed) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p
    return best?.node.level ?? 1
  }
  const jag = (y: number) => Math.round(Math.sin(y * 0.35) * 2 + Math.sin(y * 0.13 + 1) * 3)
  const ridgeX = (y: number) => MAP_W / 2 + 4 + Math.round((y - peakY) * 0.12) + Math.round(Math.sin(y * 0.2) * 2)
  for (let y = peakY; y < base; y++) {
    const half = 2 + (y - peakY) * slope
    const left = Math.floor(MAP_W / 2 - half + jag(y))
    const right = Math.ceil(MAP_W / 2 + half - jag(y + 7))
    const info = BIOMES[biomeOf(levelAt(y))]
    const above = BIOMES[biomeOf(levelAt(y - 5))]
    const rx = ridgeX(y)
    for (let x = Math.max(0, left); x < Math.min(MAP_W, right); x++) {
      const band = above !== info && dither(x, y, 0.5) ? above : info
      const lit = x < rx
      let col = lit ? band.colors[1] : shade(band.colors[0], 0.95)
      if (lit && x < left + 3) col = shade(band.colors[1], 1.25) // rim light on the left edge
      if (!lit && x < rx + 2) col = shade(band.colors[0], 0.7) // crease along the ridge
      if (x === left || x === right - 1) col = '#140e22' // outline
      if (rand() < 0.04) col = shade(lit ? band.colors[1] : band.colors[0], 0.8) // rock texture
      px(x, y, col)
    }
  }
  // snow cap and the storm cloud at the summit
  for (let y = peakY; y < peakY + 22; y++) {
    const half = 2 + (y - peakY) * slope
    const edge = peakY + 14 + Math.round(Math.sin(y) * 3)
    for (let x = Math.floor(MAP_W / 2 - half + 1); x < MAP_W / 2 + half - 1; x++) {
      if (y < edge - Math.abs(Math.sin(x * 0.7)) * 5) px(x, y, x < ridgeX(y) ? '#ffffff' : '#c8c8e8')
    }
  }
  ctx.fillStyle = '#2a2a4a'
  ctx.fillRect(MAP_W / 2 - 26, 4, 52, 6)
  ctx.fillRect(MAP_W / 2 - 18, 1, 30, 4)
  ctx.fillStyle = '#ffe860'
  ctx.fillRect(MAP_W / 2 + 6, 10, 1, 3)
  ctx.fillRect(MAP_W / 2 + 7, 13, 1, 3)
  // pine trees along the foot
  for (let i = 0; i < 22; i++) {
    const tx = Math.floor(rand() * MAP_W)
    const ty = base - 2 - Math.floor(rand() * 10)
    for (let k = 0; k < 7; k++) for (let d = -Math.floor(k / 2); d <= Math.floor(k / 2); d++) px(tx + d, ty - 7 + k, k < 2 ? '#2a5a3a' : '#1a3a2a')
    px(tx, ty, '#3a2414')
  }
  // dotted trail between nodes (in front of the mountain)
  const byId = new Map(placed.map((p) => [p.node.node_id, p]))
  placed.forEach((p, i) => {
    const targets = p.node.next ? p.node.next.map((id) => byId.get(id)).filter(Boolean) : [placed[i + 1]].filter(Boolean)
    for (const q of targets as Placed[]) {
      const n = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y))
      for (let k = 0; k <= n; k += 3) {
        const x = Math.round(p.x + ((q.x - p.x) * k) / n)
        const y = Math.round(p.y + ((q.y - p.y) * k) / n)
        ctx.fillStyle = '#1a1410'
        ctx.fillRect(x, y + 1, 2, 2)
        ctx.fillStyle = p.node.status === 'cleared' ? '#f8d020' : '#f4ecd8'
        ctx.fillRect(x, y, 2, 2)
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
