import { audio } from './sfx'
import { settings } from './settings'

// Music player for the team's tracks. Drop files into src/assets/music/ named by slot
// (e.g. level2.mp3) and they play there, run through a "retro" chain so any track
// sounds like it comes out of a handheld: bit-crushed, sample-rate reduced and
// band-limited to a tiny speaker. See src/assets/music/README.md and MUSIC in content.ts.

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

/** If a slot has no file, try these in order (then silence). */
const FALLBACK: Record<MusicSlot, MusicSlot[]> = {
  title: [],
  shelf: ['title'],
  map: ['title'],
  level1: ['map', 'title'],
  level2: ['map', 'title'],
  level3: ['map', 'title'],
  level4: ['map', 'title'],
  level5: ['map', 'title'],
  summit: ['map', 'title'],
  boss: ['summit', 'map', 'title'],
  victory: ['summit'],
  defeat: [],
}

const ONE_SHOT = new Set<MusicSlot>(['victory', 'defeat'])
const FADE_S = 0.5

// ---------------------------------------------------------------- retro chain

const CRUSHER = `
class Crusher extends AudioWorkletProcessor {
  constructor() { super(); this.hold = [0, 0]; this.n = 0 }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0]
    const step = 2 / 64          // ~6-bit amplitude
    const every = 4              // ~12 kHz sample-and-hold at 48 kHz
    for (let ch = 0; ch < out.length; ch++) {
      const i = inp[ch] || inp[0], o = out[ch]
      if (!i) { o.fill(0); continue }
      let n = this.n
      for (let k = 0; k < o.length; k++) {
        if (n % every === 0) this.hold[ch] = Math.round(i[k] / step) * step
        o[k] = this.hold[ch]
        n++
      }
      if (ch === out.length - 1) this.n = n
    }
    return true
  }
}
registerProcessor('cram-crusher', Crusher)
`

interface Chain {
  input: AudioNode
  gain: GainNode
}

let chain: Promise<Chain | null> | null = null

function retroChain(): Promise<Chain | null> {
  if (chain) return chain
  chain = (async () => {
    const a = audio()
    if (!a) return null
    const gain = a.createGain()
    gain.gain.value = 0
    const hp = a.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 140
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4200
    hp.connect(lp).connect(gain).connect(a.destination)
    let input: AudioNode = hp
    try {
      const url = URL.createObjectURL(new Blob([CRUSHER], { type: 'application/javascript' }))
      await a.audioWorklet.addModule(url)
      const crusher = new AudioWorkletNode(a, 'cram-crusher', { outputChannelCount: [2] })
      crusher.connect(hp)
      input = crusher
    } catch {
      // no worklet support: band-limit only
    }
    return { input, gain }
  })()
  return chain
}

// ---------------------------------------------------------------- player

let unlocked = false
let wanted: MusicSlot | null = null
let current: { slot: string; el: HTMLAudioElement; src: MediaElementAudioSourceNode | null } | null = null

function volume(): number {
  return Math.max(0, Math.min(1, settings.get().music)) * 0.8
}

function resolve(slot: MusicSlot): string | null {
  for (const s of [slot, ...FALLBACK[slot]]) if (tracks[s]) return s
  return null
}

async function apply(): Promise<void> {
  if (!unlocked || !wanted) return
  const slot = resolve(wanted)
  if (current && current.slot === slot) return
  const a = audio()
  const c = await retroChain()
  const old = current
  current = null
  if (old) {
    if (c && a) {
      c.gain.gain.cancelScheduledValues(a.currentTime)
      c.gain.gain.setTargetAtTime(0, a.currentTime, FADE_S / 4)
    }
    window.setTimeout(() => {
      old.el.pause()
      old.src?.disconnect()
    }, FADE_S * 1000)
  }
  if (!slot) return
  const el = new Audio(tracks[slot])
  el.loop = !ONE_SHOT.has(wanted)
  let src: MediaElementAudioSourceNode | null = null
  if (a && c) {
    try {
      src = a.createMediaElementSource(el)
      src.connect(c.input)
    } catch {
      src = null
    }
  }
  current = { slot, el, src }
  const start = () => {
    if (a && c && src) {
      if (a.state === 'suspended') void a.resume()
      c.gain.gain.cancelScheduledValues(a.currentTime)
      c.gain.gain.setTargetAtTime(volume(), a.currentTime + (old ? FADE_S : 0), FADE_S / 3)
    } else el.volume = volume()
  }
  window.setTimeout(
    () => {
      if (current?.el !== el) return
      el.play().then(start).catch(() => {
        // autoplay blocked or file missing: stay silent
      })
    },
    old ? FADE_S * 1000 : 0,
  )
}

/** Ask for a slot; it starts once the browser allows audio (first key or click). */
export function playMusic(slot: MusicSlot): void {
  wanted = slot
  void apply()
}

/** Call from the first user gesture. */
export function unlockMusic(): void {
  if (unlocked) return
  unlocked = true
  void apply()
}

settings.subscribe(() => {
  const a = audio()
  if (!current || !a) return
  if (current.src) void retroChain().then((c) => c?.gain.gain.setTargetAtTime(volume(), a.currentTime, 0.05))
  else current.el.volume = volume()
})

export function musicSlots(): string[] {
  return Object.keys(tracks)
}

/** For tests and the dev panel: what is playing right now. */
export function nowPlaying(): { slot: string; playing: boolean; retro: boolean } | null {
  if (!current) return null
  return { slot: current.slot, playing: !current.el.paused, retro: current.src !== null }
}

if (import.meta.env.DEV) (window as unknown as { __cramMusic: typeof nowPlaying }).__cramMusic = nowPlaying
