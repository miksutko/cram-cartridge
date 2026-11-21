// Sprite format, validation, a cached renderer, and a small "painter" that builds
// sprites from shapes with directional (top-left) shading and a darkened outline.

export interface Sprite {
  id: string
  w: number
  h: number
  palette: Record<string, string>
  /** frames[f][row] is a string of w chars; '.' is transparent. */
  frames: string[][]
  /** Named frame sequences, e.g. { idle: [0, 1], attack: [2], hurt: [3] }. */
  anims?: Record<string, number[]>
}

export function validate(s: Sprite): string[] {
  const errors: string[] = []
  s.frames.forEach((frame, f) => {
    if (frame.length !== s.h) errors.push(`${s.id} frame ${f}: ${frame.length} rows, expected ${s.h}`)
    frame.forEach((row, y) => {
      if (row.length !== s.w) errors.push(`${s.id} frame ${f} row ${y}: ${row.length} chars, expected ${s.w}`)
      for (const ch of row) if (ch !== '.' && !(ch in s.palette)) errors.push(`${s.id} frame ${f} row ${y}: unknown char "${ch}"`)
    })
  })
  return errors
}

const cache = new Map<string, string>()

/** Paint a frame once onto an offscreen canvas and return a cached data URL. */
export function frameUrl(s: Sprite, f: number): string {
  const key = `${s.id}#${f}`
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(s.w, s.h)
  const rgb: Record<string, [number, number, number]> = {}
  for (const [ch, hex] of Object.entries(s.palette)) {
    const n = parseInt(hex.slice(1), 16)
    rgb[ch] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const frame = s.frames[f] ?? s.frames[0]
  frame.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = rgb[row[x]]
      if (!col) continue
      const i = (y * s.w + x) * 4
      img.data[i] = col[0]
      img.data[i + 1] = col[1]
      img.data[i + 2] = col[2]
      img.data[i + 3] = 255
    }
  })
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL()
  cache.set(key, url)
  return url
}

// ---------------------------------------------------------------- shapes

export type Shape = (x: number, y: number) => boolean

export const ellipse =
  (cx: number, cy: number, rx: number, ry: number): Shape =>
  (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1

export const rect =
  (x0: number, y0: number, w: number, h: number): Shape =>
  (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h

export function poly(...pts: [number, number][]): Shape {
  return (x, y) => {
    const px = x + 0.5
    const py = y + 0.5
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]
      const [xj, yj] = pts[j]
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
}

/** A thick line segment with end radius r0 tapering to r1. */
export function seg(x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0): Shape {
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy || 1
  return (x, y) => {
    const px = x + 0.5
    const py = y + 0.5
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2))
    const r = r0 + (r1 - r0) * t
    return (px - (x0 + t * dx)) ** 2 + (py - (y0 + t * dy)) ** 2 <= r * r
  }
}

/** A tapering path through points: radius goes from r0 at the start to r1 at the end. */
export function path(pts: [number, number][], r0: number, r1 = r0): Shape {
  const parts: Shape[] = []
  const n = pts.length - 1
  for (let i = 0; i < n; i++) {
    const a = r0 + ((r1 - r0) * i) / n
    const b = r0 + ((r1 - r0) * (i + 1)) / n
    parts.push(seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], a, b))
  }
  return union(...parts)
}

export const union =
  (...shapes: Shape[]): Shape =>
  (x, y) =>
    shapes.some((s) => s(x, y))

export const minus =
  (a: Shape, b: Shape): Shape =>
  (x, y) =>
    a(x, y) && !b(x, y)

export const shift =
  (s: Shape, dx: number, dy: number): Shape =>
  (x, y) =>
    s(x - dx, y - dy)

// ---------------------------------------------------------------- painter

/** A material is a ramp: outline, dark, mid, light, highlight. */
export interface Material {
  o: string
  d: string
  m: string
  l: string
  h: string
}

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=?@'

export class Palette {
  colors: Record<string, string> = {}
  private byHex = new Map<string, string>()
  private next = 0

  char(hex: string): string {
    const k = hex.toLowerCase()
    const have = this.byHex.get(k)
    if (have) return have
    const ch = CHARS[this.next++]
    this.byHex.set(k, ch)
    this.colors[ch] = k
    return ch
  }

  /** ramp = [outline, dark, mid, light, highlight] */
  mat(ramp: [string, string, string, string, string]): Material {
    return { o: this.char(ramp[0]), d: this.char(ramp[1]), m: this.char(ramp[2]), l: this.char(ramp[3]), h: this.char(ramp[4]) }
  }
}

export interface FillOpts {
  /** Draw this part's own edge in its outline colour (separates overlapping parts). */
  edge?: boolean
  /** Flat colour, no shading. */
  flat?: keyof Material
  /** Skip the highlight tone. */
  noHi?: boolean
}

export class Painter {
  w: number
  h: number
  px: string[]
  outlineOf = new Map<string, string>()

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.px = new Array<string>(w * h).fill('.')
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.'
    return this.px[y * this.w + x]
  }

  set(x: number, y: number, ch: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px[y * this.w + x] = ch
  }

  fill(s: Shape, m: Material, opts: FillOpts = {}): this {
    for (const ch of [m.d, m.m, m.l, m.h, m.o]) this.outlineOf.set(ch, m.o)
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!s(x, y)) continue
        let ch: string
        if (opts.flat) ch = m[opts.flat]
        else if (opts.edge && (!s(x - 1, y) || !s(x + 1, y) || !s(x, y - 1) || !s(x, y + 1))) ch = m.o
        else {
          const up = !s(x, y - 1)
          const left = !s(x - 1, y)
          const ul = !s(x - 1, y - 1)
          const down = !s(x, y + 1) || !s(x + 1, y + 1)
          const deep = !s(x + 1, y + 2) || !s(x + 2, y + 1)
          if (up && left && !opts.noHi) ch = m.h
          else if (up || ul || (left && !s(x - 1, y - 2))) ch = m.l
          else if (down) ch = m.d
          else if (deep && (x + y) % 2 === 0) ch = m.d
          else ch = m.m
        }
        this.set(x, y, ch)
      }
    }
    return this
  }

  dot(x: number, y: number, ch: string): this {
    this.set(x, y, ch)
    return this
  }

  dots(pts: [number, number][], ch: string): this {
    for (const [x, y] of pts) this.set(x, y, ch)
    return this
  }

  /** 1px outline around everything, using each neighbour's darkened local colour. */
  outline(): this {
    const add: [number, number, string][] = []
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.get(x + dx, y + dy)
          if (n !== '.') {
            add.push([x, y, this.outlineOf.get(n) ?? n])
            break
          }
        }
      }
    }
    for (const [x, y, ch] of add) this.set(x, y, ch)
    return this
  }

  /** Remove lone pixels that touch nothing (no stray single pixels). */
  clean(): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) === '.') continue
        const alone = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].every(
          ([dx, dy]) => this.get(x + dx, y + dy) === '.',
        )
        if (alone) this.set(x, y, '.')
      }
    return this
  }

  rows(): string[] {
    const out: string[] = []
    for (let y = 0; y < this.h; y++) out.push(this.px.slice(y * this.w, (y + 1) * this.w).join(''))
    return out
  }
}

/** Build a sprite by running draw() once per frame on a fresh painter with a shared palette. */
export function build(
  id: string,
  w: number,
  h: number,
  frameCount: number,
  draw: (p: Painter, pal: Palette, f: number) => void,
  anims?: Record<string, number[]>,
): Sprite {
  const pal = new Palette()
  const frames: string[][] = []
  for (let f = 0; f < frameCount; f++) {
    const p = new Painter(w, h)
    draw(p, pal, f)
    frames.push(p.rows())
  }
  return { id, w, h, palette: pal.colors, frames, anims }
}

/** Parse a hand-drawn sprite from row strings. */
export function literal(
  id: string,
  palette: Record<string, string>,
  frames: string[][],
  anims?: Record<string, number[]>,
): Sprite {
  return { id, w: frames[0][0].length, h: frames[0].length, palette, frames, anims }
}

/** Deterministic random numbers (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
