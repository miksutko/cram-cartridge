import { rng } from './pixel'

// Each biome is drawn procedurally at 240x160 from a seeded generator, so the same
// biome always gives the same picture. Static layers are cached; the atmosphere
// (rain, snow, embers...) is drawn per frame by drawAtmosphere().

export type BiomeId = 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'summit'
/** Every drawable scene: the six biomes plus the bright dawn title scene. */
export type SceneId = BiomeId | 'title'
export const W = 240
export const H = 184
/** Where feet touch the ground in battle scenes. */
export const GROUND = 104
/** The game screen height; every scene paints its floor down to it. */
export const SCREEN_H = H

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

type RGB = [number, number, number]
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

class Raster {
  data: Uint8ClampedArray
  constructor() {
    this.data = new Uint8ClampedArray(W * H * 4)
  }
  set(x: number, y: number, c: RGB): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    this.data[i] = c[0]
    this.data[i + 1] = c[1]
    this.data[i + 2] = c[2]
    this.data[i + 3] = 255
  }
  rect(x0: number, y0: number, w: number, h: number, c: RGB): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c)
  }
  /** Vertical gradient through colour stops, ordered-dithered between neighbours. */
  gradient(y0: number, y1: number, stops: string[]): void {
    const cols = stops.map(hex)
    for (let y = y0; y < y1; y++) {
      const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (cols.length - 1)
      const i = Math.min(cols.length - 2, Math.floor(t))
      const frac = t - i
      for (let x = 0; x < W; x++) {
        const c = frac * 16 > BAYER[y & 3][x & 3] ? cols[i + 1] : cols[i]
        this.set(x, y, c)
      }
    }
  }
  /** Fill below a height function, dithering the top `band` rows between two colours. */
  ridge(height: (x: number) => number, fill: string, top?: string, band = 3, bottom = H): void {
    const c = hex(fill)
    const t = top ? hex(top) : c
    for (let x = 0; x < W; x++) {
      const h0 = Math.round(height(x))
      for (let y = Math.max(0, h0); y < bottom; y++) {
        const d = y - h0
        const c2 = d < band ? (((band - d) / band) * 16 > BAYER[y & 3][x & 3] ? t : c) : c
        this.set(x, y, c2)
      }
    }
  }
  /** Radial glow, dithered so it reads as light without blending. */
  glow(cx: number, cy: number, r: number, color: string, strength = 0.6): void {
    const c = hex(color)
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy) / r
        if (d > 1 || x < 0 || y < 0 || x >= W || y >= H) continue
        if ((1 - d) * strength * 16 > BAYER[y & 3][x & 3]) {
          const i = (y * W + x) * 4
          this.data[i] = Math.round((this.data[i] + c[0]) / 2)
          this.data[i + 1] = Math.round((this.data[i + 1] + c[1]) / 2)
          this.data[i + 2] = Math.round((this.data[i + 2] + c[2]) / 2)
        }
      }
  }
  poly(pts: [number, number][], color: string): void {
    const c = hex(color)
    const ys = pts.map((p) => p[1])
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      for (let x = 0; x < W; x++) {
        let inside = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]
          const [xj, yj] = pts[j]
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (inside) this.set(x, y, c)
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string, w = 1): void {
    const c = hex(color)
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n
      const y = y0 + ((y1 - y0) * k) / n
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < w; dy++) this.set(x + dx - (w >> 1), y + dy - (w >> 1), c)
    }
  }
}

function waves(r: () => number, base: number, amp: number, n = 3): (x: number) => number {
  const parts = Array.from({ length: n }, (_, i) => ({ f: (0.02 + r() * 0.05) * (i + 1), p: r() * 6.28, a: amp / (i + 1) }))
  return (x) => base + parts.reduce((s, q) => s + Math.sin(x * q.f + q.p) * q.a, 0)
}

function tree(R: Raster, r: () => number, x: number, ground: number, h: number, color: string): void {
  R.line(x, ground, x, ground - h, color, 3)
  const branch = (bx: number, by: number, ang: number, len: number, depth: number) => {
    if (depth === 0 || len < 3) return
    const ex = bx + Math.cos(ang) * len
    const ey = by + Math.sin(ang) * len
    R.line(Math.round(bx), Math.round(by), Math.round(ex), Math.round(ey), color, depth > 2 ? 2 : 1)
    branch(ex, ey, ang - 0.5 - r() * 0.3, len * 0.7, depth - 1)
    branch(ex, ey, ang + 0.4 + r() * 0.3, len * 0.65, depth - 1)
  }
  branch(x, ground - h, -Math.PI / 2 - 0.4, h * 0.45, 4)
  branch(x, ground - h * 0.7, -Math.PI / 2 + 0.6, h * 0.35, 3)
}

const PAINT: Record<SceneId, (R: Raster, r: () => number) => void> = {
  title(R, r) {
    // Dawn over Mount Cram: a warm, hopeful sky for the title screen.
    R.gradient(0, 112, ['#2a1a5e', '#5a2a8a', '#b04a8a', '#f07a5a', '#ffb860', '#ffe0a0'])
    R.glow(178, 96, 46, '#fff0b0', 0.85)
    for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) if (x * x + y * y <= 144 && 96 + y < 100) R.set(178 + x, 96 + y, hex(x * x + y * y > 110 ? '#ffd870' : '#fff4c0'))
    for (let i = 0; i < 8; i++) {
      const cx = r() * W
      const cy = 12 + r() * 46
      for (let k = 0; k < 5; k++) R.glow(cx + k * 8 - 16, cy + (k % 2) * 2, 9, i % 2 ? '#ffb0c0' : '#ffd8a0', 0.6)
    }
    // distant purple range, then Mount Cram itself with a snowy peak
    R.ridge(waves(r, 84, 7), '#6a3a8a', '#9a5aa8', 3)
    R.poly([[20, 112], [96, 22], [112, 30], [124, 16], [200, 112]], '#3e2a6a')
    R.poly([[96, 22], [112, 30], [124, 16], [134, 34], [122, 40], [110, 36], [100, 42], [88, 36]], '#f4f0ff')
    R.poly([[124, 16], [200, 112], [160, 112], [128, 40]], '#2e1e54')
    R.ridge(waves(r, 100, 3), '#3a7a3a', '#6ab84a', 3)
    // the ruined temple, lit gold by the sunrise
    R.rect(150, 66, 62, 5, hex('#c8963a'))
    R.poly([[146, 66], [181, 52], [216, 66]], '#e0b04a')
    for (const x of [154, 168, 182, 196]) {
      R.rect(x, 71, 5, 28, hex('#f0d080'))
      R.rect(x + 3, 71, 2, 28, hex('#b8863a'))
    }
    R.ridge(waves(r, GROUND + 2, 1.5), '#4a9a3a', '#8ad050', 2)
    for (let i = 0; i < 50; i++) R.set(r() * W, GROUND + 4 + r() * 40, hex(i % 3 ? '#3a8a34' : '#f8e070'))
    R.ridge(waves(r, 128, 3), '#2e6a2e', '#4a9a3a', 2)
  },
  l1(R, r) {
    // Underground labyrinth: stone walls, dark arches, torchlight.
    R.gradient(0, H, ['#120c0c', '#1e1614', '#2a201c'])
    for (let row = 0; row < 12; row++) {
      const y = 8 + row * 8
      const off = row % 2 ? 0 : 8
      for (let x = -off; x < W; x += 16) {
        const shade = ['#2e2420', '#352a24', '#2a201c'][Math.floor(r() * 3)]
        R.rect(x + 1, y + 1, 14, 6, hex(shade))
      }
    }
    for (const ax of [36, 120, 204]) {
      R.poly([[ax - 18, GROUND], [ax - 18, 50], [ax - 11, 39], [ax, 35], [ax + 11, 39], [ax + 18, 50], [ax + 18, GROUND]], '#4a3a30')
      R.poly([[ax - 16, GROUND], [ax - 16, 50], [ax - 10, 40], [ax, 36], [ax + 10, 40], [ax + 16, 50], [ax + 16, GROUND]], '#0a0606')
    }
    R.rect(0, GROUND - 2, W, H - GROUND + 2, hex('#3a2e26'))
    for (let x = 0; x < W; x += 12) R.rect(x, GROUND - 2, 1, H, hex('#241a14'))
    for (let y = GROUND + 6; y < H; y += 8) R.rect(0, y, W, 1, hex('#241a14'))
    R.rect(0, GROUND - 2, W, 1, hex('#5a463a'))
    for (const tx of [78, 162]) {
      R.glow(tx, 44, 34, '#ff9a2a', 0.75)
      R.rect(tx - 1, 46, 3, 12, hex('#4a2a14'))
      R.rect(tx - 2, 44, 5, 2, hex('#6a4020'))
    }
  },
  l2(R, r) {
    // Stormy cave mouth over the sea: player on the cliff, the Hydra in deep water.
    R.gradient(0, 90, ['#05070c', '#121826', '#26304a', '#3c4a64'])
    for (let i = 0; i < 7; i++) {
      const cx = r() * W
      const cy = 10 + r() * 40
      for (let k = 0; k < 5; k++) R.glow(cx + k * 9 - 18, cy + (k % 2) * 3, 12, '#5a6478', 0.5)
    }
    R.ridge(waves(r, 82, 3), '#0e1c3a', '#1c3460', 3)
    const ship = 170
    R.poly([[ship - 24, 86], [ship + 20, 84], [ship + 14, 94], [ship - 18, 94]], '#0a0a10')
    R.line(ship - 4, 86, ship - 2, 50, '#0a0a10', 2)
    R.line(ship - 2, 56, ship + 14, 64, '#0a0a10')
    R.poly([[ship - 2, 54], [ship + 12, 62], [ship - 1, 70]], '#141422')
    R.ridge(waves(r, 96, 2), '#12306a', '#3a6ac0', 2)
    for (let y = 98; y < H; y += 5) for (let x = (y * 7) % 11; x < W; x += 17) R.rect(x, y, 4, 1, hex('#5a8ad0'))
    R.poly([[0, 0], [70, 0], [40, 30], [18, 70], [0, 90]], '#0a0c14')
    R.poly([[W, 0], [180, 0], [214, 26], [232, 60], [W, 70]], '#0a0c14')
    R.poly([[0, GROUND - 4], [96, GROUND - 2], [104, GROUND + 8], [92, H], [0, H]], '#2a2c36')
    R.ridge((x) => (x < 98 ? GROUND - 4 + (x > 90 ? (x - 90) / 2 : 0) : H), '#3a3c4a', '#5a5e70', 2, GROUND + 2)
  },
  l3(R, r) {
    // Dead forest under the moon.
    R.gradient(0, 110, ['#0a0e0c', '#141e1a', '#22302a', '#34443a'])
    // the moon sits between the fighters, clear of the boss's head
    R.glow(104, 26, 24, '#c8d8c0', 0.5)
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 81) R.set(104 + x, 26 + y, hex(x * x + y * y > 56 ? '#b4c4ac' : '#dce8d4'))
    for (const [cx, cy] of [[101, 23], [107, 29], [106, 22]] as [number, number][]) R.set(cx, cy, hex('#b4c4ac'))
    R.ridge(waves(r, 80, 5), '#18221c', '#22302a', 3)
    for (let i = 0; i < 9; i++) tree(R, r, 10 + i * 27 + r() * 10, 86, 34 + r() * 18, '#101612')
    R.ridge(waves(r, 92, 2), '#141a14', '#1e281e', 2)
    for (const x of [4, 108, 228]) tree(R, r, x, GROUND, 56 + r() * 20, '#060806')
    R.ridge(waves(r, GROUND - 1, 1.5), '#2a1e14', '#3a2c1e', 2)
    for (let i = 0; i < 40; i++) R.set(r() * W, GROUND + 2 + r() * (H - GROUND), hex('#1a120c'))
  },
  l4(R, r) {
    // Snowy mountain: icy sky, snow-capped peaks, frost-tipped trees.
    R.gradient(0, 100, ['#5a8ac4', '#8ab4e0', '#c0dcf4', '#e4f2fc'])
    const far = waves(r, 54, 14)
    R.ridge(far, '#6a82a4', '#ffffff', 5)
    const mid = waves(r, 74, 9)
    R.ridge(mid, '#4a5e7a', '#e8f2fc', 4)
    for (let i = 0; i < 12; i++) {
      const x = r() * W
      const base = 92 + r() * 6
      const h = 14 + r() * 10
      R.poly([[x - 6, base], [x, base - h], [x + 6, base]], '#1e3a3a')
      R.poly([[x - 3, base - h + 6], [x, base - h], [x + 3, base - h + 6]], '#ffffff')
      R.rect(Math.round(x) - 1, base, 2, 3, hex('#3a2a20'))
    }
    R.ridge(waves(r, GROUND - 2, 2), '#e8f2fc', '#ffffff', 2)
    for (let i = 0; i < 60; i++) R.set(r() * W, GROUND + r() * (H - GROUND), hex('#b8d0e8'))
    R.ridge(waves(r, 128, 2), '#c8dcf0', '#e8f2fc', 2)
  },
  l5(R, r) {
    // Volcano: purple sky, a glowing cone, crumbling purple rock, lava.
    R.gradient(0, 100, ['#1a0a24', '#3a1036', '#6a1a30', '#a0301e'])
    R.poly([[60, 100], [108, 34], [132, 34], [190, 100]], '#2a1020')
    R.glow(120, 34, 26, '#ff6a1a', 0.7)
    R.poly([[110, 34], [130, 34], [124, 40], [116, 40]], '#ffb040')
    R.line(122, 40, 128, 60, '#ff7a1a', 2)
    R.line(128, 60, 124, 84, '#ff5a1a', 2)
    R.ridge(waves(r, 92, 4), '#2a1230', '#4a2050', 3)
    for (const [x, h] of [[16, 46], [212, 52], [40, 30]] as [number, number][]) {
      R.poly([[x - 8, GROUND], [x - 6, GROUND - h], [x + 2, GROUND - h - 4], [x + 8, GROUND - h + 6], [x + 9, GROUND]], '#3a1a48')
      R.line(x - 5, GROUND - h + 4, x - 5, GROUND - 4, '#5a2a6a')
    }
    R.ridge(waves(r, GROUND - 2, 1.5), '#2a1420', '#4a2030', 2, 130)
    R.ridge(waves(r, 132, 2), '#d0401a', '#ffb030', 3)
    R.glow(120, 150, 60, '#ff6a1a', 0.5)
  },
  summit(R, r) {
    // Cloudy summit: ruined temple, broken bridges, storm light.
    R.gradient(0, 110, ['#2a2e3a', '#4a5060', '#7a8090', '#a4a8b0'])
    for (let i = 0; i < 9; i++) {
      const cx = r() * W
      const cy = 14 + r() * 50
      for (let k = 0; k < 6; k++) R.glow(cx + k * 8 - 20, cy + (k % 3) * 2, 11, '#c8ccd4', 0.55)
    }
    R.ridge(waves(r, 86, 5), '#3a3e3a', '#5a6050', 3)
    // ruined temple
    R.rect(150, 52, 70, 6, hex('#6a5a3a'))
    R.poly([[146, 52], [185, 36], [224, 52]], '#7a6a44')
    R.poly([[200, 40], [224, 52], [210, 52]], '#a4a8b0')
    for (const x of [154, 170, 186, 202]) {
      R.rect(x, 58, 6, 34, hex('#8a7a54'))
      R.rect(x + 4, 58, 2, 34, hex('#5a4a30'))
    }
    R.rect(214, 70, 6, 22, hex('#8a7a54'))
    R.rect(182, 40, 6, 4, hex('#d4a820'))
    // broken bridge
    R.line(20, 76, 96, 82, '#4a3420', 2)
    for (let x = 22; x < 92; x += 6) R.line(x, 77 + (x - 20) / 13, x, 81 + (x - 20) / 13, '#6a4a2a')
    R.line(96, 82, 102, 92, '#4a3420')
    R.ridge(waves(r, GROUND - 2, 1.5), '#4a4a3a', '#6a7a4a', 2)
    for (let i = 0; i < 30; i++) R.set(r() * W, GROUND + r() * 10, hex('#4a7a3a'))
    R.ridge(waves(r, 124, 3), '#3a3a34', '#5a5a4a', 2)
  },
}

const SEEDS: Record<SceneId, number> = { l1: 11, l2: 23, l3: 37, l4: 41, l5: 53, summit: 67, title: 71 }
const cache = new Map<string, HTMLCanvasElement>()

export function backgroundCanvas(id: SceneId): HTMLCanvasElement {
  const hit = cache.get(id)
  if (hit) return hit
  const R = new Raster()
  PAINT[id](R, rng(SEEDS[id]))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(W, H)
  img.data.set(R.data)
  ctx.putImageData(img, 0, 0)
  cache.set(id, c)
  return c
}

// ---------------------------------------------------------------- atmosphere

interface Particle {
  x: number
  y: number
  v: number
  s: number
}

export interface Atmos {
  parts: Particle[]
  flash: number
}

export function makeAtmos(id: SceneId): Atmos {
  const r = rng(SEEDS[id] + 1)
  const n = { l1: 0, l2: 90, l3: 14, l4: 70, l5: 40, summit: 6, title: 7 }[id]
  return { parts: Array.from({ length: n }, () => ({ x: r() * W, y: r() * H, v: 0.5 + r(), s: r() })), flash: 0 }
}

/** Draw one frame of the biome's moving layer onto ctx (cleared first). t is in frames (~15fps). */
export function drawAtmosphere(ctx: CanvasRenderingContext2D, id: SceneId, a: Atmos, t: number): void {
  ctx.clearRect(0, 0, W, H)
  const px = (x: number, y: number, c: string, w = 1, h = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }
  if (id === 'l1') {
    // torch flames flicker
    for (const tx of [78, 162]) {
      const k = (t + tx) % 4
      px(tx - 2, 39 + (k % 2), '#ff7a1a', 5, 5)
      px(tx - 1, 37 + (k === 3 ? 1 : 0), '#ffd040', 3, 5)
      px(tx, 36 + (k === 1 ? 1 : 0), '#fff4c0', 1, 3)
      if (k === 0) px(tx + 2, 34, '#ffb040')
    }
  } else if (id === 'l2') {
    for (const p of a.parts) {
      p.y += 5 * p.v
      p.x -= 1.5 * p.v
      if (p.y > H) {
        p.y = -4
        p.x = Math.random() * (W + 40)
      }
      px(p.x, p.y, '#8aa4c8', 1, 3)
    }
    if (a.flash <= 0 && Math.random() < 0.01) a.flash = 6
    if (a.flash > 0) {
      a.flash--
      if (a.flash > 3) {
        ctx.fillStyle = 'rgba(220,235,255,0.35)'
        ctx.fillRect(0, 0, W, H)
        let x = 120 + Math.random() * 60
        for (let y = 0; y < 60; y += 4) {
          const nx = x + (Math.random() * 8 - 4)
          ctx.fillStyle = '#f0f8ff'
          ctx.fillRect(Math.round(Math.min(x, nx)), y, Math.max(1, Math.round(Math.abs(nx - x))), 4)
          x = nx
        }
      }
    }
  } else if (id === 'l3') {
    // mist bands and fireflies
    ctx.fillStyle = 'rgba(180,200,180,0.08)'
    for (let i = 0; i < 3; i++) ctx.fillRect(((t * (i + 1) * 0.4) % (W + 120)) - 120, 70 + i * 12, 120, 6)
    for (const p of a.parts) {
      p.x += Math.sin((t + p.s * 50) / 9) * 0.5
      p.y += Math.cos((t + p.s * 80) / 11) * 0.4
      if ((t + Math.floor(p.s * 20)) % 20 < 13) px(p.x, p.y, '#d8ff70')
    }
  } else if (id === 'l4') {
    const gust = Math.sin(t / 30) > 0.7 ? 3 : 0.6
    for (const p of a.parts) {
      p.y += 0.6 * p.v
      p.x -= gust * p.v
      if (p.y > H) p.y = -2
      if (p.x < -2) p.x = W
      px(p.x, p.y, '#ffffff', p.s > 0.7 ? 2 : 1, p.s > 0.7 ? 2 : 1)
    }
  } else if (id === 'l5') {
    for (const p of a.parts) {
      p.y -= 0.8 * p.v
      p.x += Math.sin((t + p.s * 40) / 8) * 0.4
      if (p.y < 0) {
        p.y = H
        p.x = Math.random() * W
      }
      px(p.x, p.y, p.s > 0.5 ? '#ffb030' : '#ff5a1a')
    }
    ctx.fillStyle = `rgba(255,90,30,${0.06 + 0.04 * Math.sin(t / 6)})`
    ctx.fillRect(0, 120, W, 40)
  } else {
    ctx.fillStyle = id === 'title' ? 'rgba(255,230,240,0.3)' : 'rgba(220,225,235,0.22)'
    for (const p of a.parts) {
      p.x -= 0.25 * p.v
      if (p.x < -60) p.x = W + 10
      ctx.fillRect(Math.round(p.x), Math.round(20 + p.s * 60), 50, 5)
      ctx.fillRect(Math.round(p.x) + 8, Math.round(17 + p.s * 60), 30, 3)
    }
    if (id === 'title') return
    if (a.flash <= 0 && Math.random() < 0.006) a.flash = 5
    if (a.flash > 0) {
      a.flash--
      if (a.flash > 2) {
        ctx.fillStyle = 'rgba(255,250,220,0.3)'
        ctx.fillRect(0, 0, W, H)
      }
    }
  }
}

export function biomeOf(level: number | string | null | undefined): BiomeId {
  if (level === 'summit') return 'summit'
  const n = Number(level)
  return n >= 1 && n <= 5 ? (`l${n}` as BiomeId) : 'l1'
}
