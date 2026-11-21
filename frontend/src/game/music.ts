import { audio } from './sfx'
import { settings } from './settings'
import { SONG_FOR_SLOT, SONGS, type Song } from './songs'

// A tiny chiptune player: our own songs (songs.ts) synthesised live with Web Audio —
// pulse-wave lead, triangle bass, noise drums — through a small-speaker filter.
// No audio files. Music starts after the first key press or click (browsers block
// autoplay), loops, and crossfades between slots.

export type MusicSlot =
  | 'title' | 'shelf' | 'map'
  | 'level1' | 'level2' | 'level3' | 'level4' | 'level5'
  | 'summit' | 'boss' | 'victory' | 'defeat'

interface Ev {
  step: number
  freq: number
  len: number
}

interface Compiled {
  song: Song
  steps: number
  lead: Ev[]
  harmony: Ev[]
  bass: Ev[]
  drums: string[]
}

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function freq(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)
  if (!m) return 0
  const semis = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12
  return 440 * 2 ** ((semis - 69) / 12)
}

function parseLine(text: string): { events: Ev[]; steps: number } {
  const toks = text.replace(/\|/g, ' ').split(/\s+/).filter(Boolean)
  const events: Ev[] = []
  toks.forEach((t, i) => {
    const last = events[events.length - 1]
    if (t === '-' && last && last.step + last.len === i) last.len++
    else if (t !== '.' && t !== '-') events.push({ step: i, freq: freq(t), len: 1 })
  })
  return { events, steps: toks.length }
}

function bassFor(roots: string, style: Song['bassStyle'], bars: number): Ev[] {
  const rs = roots.split(/\s+/).filter(Boolean).map(freq)
  const out: Ev[] = []
  for (let b = 0; b < bars; b++) {
    const f = rs[b % rs.length]
    const at = b * 16
    const pat: [number, number, number][] = // [step, frequency multiplier, length]
      style === 'pulse'
        ? [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, s % 4 === 2 ? 2 : 1, 1])
        : style === 'octave'
          ? [[0, 1, 3], [4, 2, 2], [8, 1, 3], [12, 2, 2]]
          : style === 'drone'
            ? [[0, 1, 14]]
            : style === 'arp'
              ? [[0, 1, 2], [3, 1.5, 2], [6, 2, 2], [9, 1.5, 2], [12, 1, 2]]
              : [0, 3, 4, 6, 7, 8, 11, 12, 14, 15].map((s) => [s, s % 8 === 0 ? 1 : s % 4 === 3 ? 2 : 1, 1])
    for (const [s, mul, len] of pat) out.push({ step: at + s, freq: f * mul, len })
  }
  return out
}

const compiled = new Map<string, Compiled>()
function compile(name: string): Compiled {
  const hit = compiled.get(name)
  if (hit) return hit
  const song = SONGS[name]
  const { events, steps } = parseLine(song.lead)
  const bars = Math.ceil(steps / 16)
  const harmony = song.harmony ? parseLine(song.harmony).events : []
  const c: Compiled = { song, steps: bars * 16, lead: events, harmony, bass: bassFor(song.roots, song.bassStyle, bars), drums: song.drums.split(/\s+/) }
  compiled.set(name, c)
  return c
}

// ---------------------------------------------------------------- instruments

const waves = new Map<number, PeriodicWave>()
function pulse(a: AudioContext, duty: number): PeriodicWave {
  const hit = waves.get(duty)
  if (hit) return hit
  const n = 32
  const real = new Float32Array(n)
  const imag = new Float32Array(n)
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty)
  const w = a.createPeriodicWave(real, imag)
  waves.set(duty, w)
  return w
}

let noiseBuf: AudioBuffer | null = null
function noise(a: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf
  noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.3), a.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

function note(a: AudioContext, out: AudioNode, f: number, t: number, dur: number, wave: Song['leadWave'] | 'bass', vol: number): void {
  if (!f) return
  const o = a.createOscillator()
  if (wave === 'triangle' || wave === 'bass') o.type = 'triangle'
  else o.setPeriodicWave(pulse(a, wave))
  o.frequency.setValueAtTime(f, t)
  const g = a.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.005)
  g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.01, dur - 0.03))
  g.gain.linearRampToValueAtTime(0, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function drum(a: AudioContext, out: AudioNode, kind: string, t: number): void {
  if (kind === 'k') {
    const o = a.createOscillator()
    const g = a.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.15)
    return
  }
  const src = a.createBufferSource()
  src.buffer = noise(a)
  const f = a.createBiquadFilter()
  f.type = kind === 'h' ? 'highpass' : 'bandpass'
  f.frequency.value = kind === 'h' ? 7000 : 1800
  const g = a.createGain()
  const dur = kind === 'h' ? 0.03 : 0.12
  g.gain.setValueAtTime(kind === 'h' ? 0.12 : 0.3, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t)
  src.stop(t + dur + 0.01)
}

// ---------------------------------------------------------------- player

interface Playing {
  slot: MusicSlot
  name: string
  bus: GainNode
  timer: number
  nextStep: number
  nextTime: number
}

let unlocked = false
let wanted: MusicSlot | null = null
let current: Playing | null = null
let master: GainNode | null = null

function volume(): number {
  return Math.max(0, Math.min(1, settings.get().music)) * 0.35
}

function output(a: AudioContext): GainNode {
  if (master) return master
  master = a.createGain()
  master.gain.value = volume()
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 6000
  master.connect(lp).connect(a.destination)
  return master
}

function stop(p: Playing, a: AudioContext): void {
  window.clearInterval(p.timer)
  p.bus.gain.cancelScheduledValues(a.currentTime)
  p.bus.gain.setTargetAtTime(0, a.currentTime, 0.12)
  window.setTimeout(() => p.bus.disconnect(), 800)
}

function start(slot: MusicSlot): void {
  const a = audio()
  if (!a) return
  if (a.state === 'suspended') void a.resume()
  const name = SONG_FOR_SLOT[slot] ?? 'title'
  if (current && current.name === name) {
    current.slot = slot
    return
  }
  if (current) stop(current, a)
  const c = compile(name)
  const bus = a.createGain()
  bus.gain.setValueAtTime(0, a.currentTime)
  bus.gain.linearRampToValueAtTime(1, a.currentTime + 0.5)
  bus.connect(output(a))
  const stepDur = 60 / c.song.bpm / 4
  const p: Playing = { slot, name, bus, timer: 0, nextStep: 0, nextTime: a.currentTime + 0.12 }
  const leadAt = new Map(c.lead.map((e) => [e.step, e]))
  const bassAt = new Map(c.bass.map((e) => [e.step, e]))
  const harmAt = new Map(c.harmony.map((e) => [e.step, e]))
  const tick = () => {
    while (p.nextTime < a.currentTime + 0.15) {
      if (p.nextStep >= c.steps) {
        if (!c.song.loop) {
          window.clearInterval(p.timer)
          return
        }
        p.nextStep = 0
      }
      const s = p.nextStep
      const l = leadAt.get(s)
      if (l) note(a, bus, l.freq, p.nextTime, l.len * stepDur * 0.95, c.song.leadWave, 0.16)
      const h = harmAt.get(s)
      if (h) note(a, bus, h.freq, p.nextTime, h.len * stepDur * 0.95, 0.5, 0.07)
      const b = bassAt.get(s)
      if (b) note(a, bus, b.freq, p.nextTime, b.len * stepDur * 0.9, 'bass', 0.22)
      const d = c.drums[s % c.drums.length]
      if (d && d !== '.') drum(a, bus, d, p.nextTime)
      p.nextStep++
      p.nextTime += stepDur
    }
  }
  p.timer = window.setInterval(tick, 25)
  tick()
  current = p
}

/** Ask for a slot; it starts once the browser allows audio (first key or click). */
export function playMusic(slot: MusicSlot): void {
  wanted = slot
  if (unlocked) window.setTimeout(() => wanted === slot && start(slot), 0)
}

/** Call from the first user gesture. */
export function unlockMusic(): void {
  if (unlocked) return
  unlocked = true
  // after the key/click handler returns: audio start-up never delays input
  window.setTimeout(() => wanted && start(wanted), 0)
}

settings.subscribe(() => {
  const a = audio()
  if (master && a) master.gain.setTargetAtTime(volume(), a.currentTime, 0.05)
})

/** For tests: what is playing right now. */
export function nowPlaying(): { slot: string; song: string } | null {
  return current ? { slot: current.slot, song: current.name } : null
}

if (import.meta.env.DEV) (window as unknown as { __cramMusic: typeof nowPlaying }).__cramMusic = nowPlaying
