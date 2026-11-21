import { settings } from './settings'

// Music player for the team's own tracks. Drop files into src/assets/music/ named by
// slot (e.g. level2.mp3) and they play in that slot. A missing slot falls back to
// "map", then to silence. See src/assets/music/README.md.

export type MusicSlot =
  | 'title' | 'shelf' | 'map'
  | 'level1' | 'level2' | 'level3' | 'level4' | 'level5'
  | 'summit' | 'boss' | 'victory' | 'defeat'

const files = import.meta.glob('../assets/music/*.{mp3,ogg,wav}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const tracks: Partial<Record<string, string>> = {}
for (const [path, url] of Object.entries(files)) {
  const slot = path.split('/').pop()!.replace(/\.(mp3|ogg|wav)$/, '')
  tracks[slot] = url
}

const ONE_SHOT = new Set<MusicSlot>(['victory', 'defeat'])
const FADE_MS = 500

let unlocked = false
let wanted: MusicSlot | null = null
let current: { slot: string; el: HTMLAudioElement } | null = null

function volume(): number {
  return Math.max(0, Math.min(1, settings.get().music))
}

function fade(el: HTMLAudioElement, from: number, to: number, done?: () => void): void {
  const start = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / FADE_MS)
    el.volume = from + (to - from) * k
    if (k < 1) requestAnimationFrame(step)
    else done?.()
  }
  requestAnimationFrame(step)
}

function resolve(slot: MusicSlot): string | null {
  if (tracks[slot]) return slot
  if (tracks.map) return 'map'
  return null
}

function apply(): void {
  if (!unlocked || !wanted) return
  const slot = resolve(wanted)
  if (current && current.slot === slot) return
  const old = current
  if (old) fade(old.el, old.el.volume, 0, () => old.el.pause())
  current = null
  if (!slot) return
  const el = new Audio(tracks[slot])
  el.loop = !ONE_SHOT.has(wanted)
  el.volume = 0
  current = { slot, el }
  el.play()
    .then(() => fade(el, 0, volume()))
    .catch(() => {
      // autoplay blocked or file missing: stay silent
    })
}

/** Ask for a slot; it starts once the browser allows audio (first key or click). */
export function playMusic(slot: MusicSlot): void {
  wanted = slot
  apply()
}

/** Call from the first user gesture. */
export function unlockMusic(): void {
  if (unlocked) return
  unlocked = true
  apply()
}

settings.subscribe(() => {
  if (current) current.el.volume = volume()
})

export function musicSlots(): string[] {
  return Object.keys(tracks)
}
