import { validate, type Sprite } from './pixel'
import { hydra, minotaur, phoenix, player, retep, thornhart, yeti } from './sprites/heroes'
import { brinecrab, cinderSlug, frostImp, hollowCrow, torchmite } from './sprites/minions'
import * as icons from './sprites/icons'

export const sprites: Record<string, Sprite> = {}

const all: Sprite[] = [
  player, minotaur, hydra, thornhart, yeti, phoenix, retep,
  torchmite, brinecrab, hollowCrow, frostImp, cinderSlug,
  icons.heart, icons.splitRune, icons.sagesWhisper, icons.heartstone, icons.aegisWard, icons.itemUnknown,
  icons.nodeEnemy, icons.nodeMiniboss, icons.nodeTreasure, icons.nodeBlitz, icons.nodeBoss,
  icons.nodeCleared, icons.nodeLocked, icons.nodeCurrent, icons.chest, icons.cartridge, icons.emptySlot,
]

for (const s of all) {
  const errors = validate(s)
  if (errors.length) console.error(`[art] sprite "${s.id}" is malformed:\n${errors.slice(0, 5).join('\n')}`)
  sprites[s.id] = s
}

/**
 * Designer override: drop frontend/src/assets/sprites/<id>.png and it replaces the
 * code sprite of the same id, with no code changes.
 */
const pngs = import.meta.glob('../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const overrides: Record<string, string> = {}
for (const [file, url] of Object.entries(pngs)) {
  const id = file.split('/').pop()!.replace(/\.png$/, '')
  overrides[id] = url
}

export const allSprites = all
