import { settings } from './settings'

// Sound effects generated with Web Audio (square waves and noise). No files.

let ctx: AudioContext | null = null

export function audio(): AudioContext | null {
  if (ctx) return ctx
  try {
    ctx = new AudioContext()
  } catch {
    ctx = null
  }
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.08, slideTo?: number): void {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise(start: number, dur: number, vol = 0.1, lowpass = 1200): void {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + start
  const len = Math.floor(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = lowpass
  const g = a.createGain()
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t0)
}

const SOUNDS = {
  blip: () => tone(880, 0, 0.05, 'square', 0.04),
  confirm: () => {
    tone(660, 0, 0.06, 'square', 0.05)
    tone(990, 0.06, 0.08, 'square', 0.05)
  },
  hit: () => {
    noise(0, 0.12, 0.12, 2400)
    tone(220, 0, 0.12, 'square', 0.06, 110)
  },
  miss: () => {
    tone(196, 0, 0.18, 'sawtooth', 0.07, 98)
    noise(0.02, 0.2, 0.1, 600)
  },
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.12, 'square', 0.05)),
  roar: () => {
    noise(0, 0.9, 0.18, 400)
    tone(110, 0, 0.9, 'sawtooth', 0.08, 55)
  },
  treasure: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.14, 'triangle', 0.07)),
  thunder: () => noise(0, 1.2, 0.2, 300),
}

export type SoundName = keyof typeof SOUNDS

export function sfx(name: SoundName): void {
  if (!settings.get().sfx) return
  const a = audio()
  if (!a) return
  if (a.state === 'suspended') void a.resume()
  try {
    SOUNDS[name]()
  } catch {
    // audio is optional
  }
}
