import { GAME } from './content'
import { load, save } from './storage'
import { createStore } from './store'

export type TextSpeed = 'slow' | 'normal' | 'instant'
export type ScaleSetting = 'auto' | 2 | 3 | 4

export interface Settings {
  name: string | null
  music: number // 0..1
  sfx: boolean
  textSpeed: TextSpeed
  scale: ScaleSetting
  reducedMotion: boolean
}

const DEFAULTS: Settings = { name: null, music: 0.5, sfx: true, textSpeed: 'normal', scale: 'auto', reducedMotion: false }

export const settings = createStore<Settings>({ ...DEFAULTS, ...load<Partial<Settings>>('cram-settings', {}) })
settings.subscribe(() => save('cram-settings', settings.get()))

export function update(patch: Partial<Settings>): void {
  settings.set((s) => ({ ...s, ...patch }))
}

/** 1-10 chars, A-Z 0-9 and space, trimmed, upper case; empty -> QUILL. */
export function cleanName(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10).trim()
  return s || GAME.defaultName
}

export function playerName(): string {
  return settings.get().name ?? GAME.defaultName
}

export function prefersReducedMotion(): boolean {
  try {
    return settings.get().reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return settings.get().reducedMotion
  }
}

export const TEXT_MS: Record<TextSpeed, number> = { slow: 45, normal: 18, instant: 0 }
