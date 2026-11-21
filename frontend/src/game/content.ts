// Every name, word and line of flavour text in the game lives here, so the designer
// can rename anything without touching components.

import type { BiomeId } from '../art/backgrounds'

export const GAME = {
  title: 'CRAM CARTRIDGE',
  hook: 'YOUR LECTURE NOTES ARE NOW A BOSS FIGHT.',
  mountain: 'Mount Cram',
  defaultName: 'QUILL',
  pressStart: 'PRESS START',
}

export interface BiomeInfo {
  id: BiomeId
  level: number | 'summit'
  name: string
  card: string
  boss: string
  bossSprite: string
  minion: string
  minionSprite: string
  /** [dark, mid, light] used by UI bars and map bands. */
  colors: [string, string, string]
}

export const BIOMES: Record<BiomeId, BiomeInfo> = {
  l1: { id: 'l1', level: 1, name: 'The Labyrinth Below', card: 'LEVEL 1 · THE LABYRINTH BELOW', boss: 'Minotaur', bossSprite: 'minotaur', minion: 'Torchmite', minionSprite: 'torchmite', colors: ['#2a201c', '#7a4a22', '#ff9a2a'] },
  l2: { id: 'l2', level: 2, name: 'The Stormy Cave', card: 'LEVEL 2 · THE STORMY CAVE', boss: 'Hydra', bossSprite: 'hydra', minion: 'Brinecrab', minionSprite: 'brinecrab', colors: ['#0e1c3a', '#1c4a94', '#e8f4ff'] },
  l3: { id: 'l3', level: 3, name: 'The Dead Forest', card: 'LEVEL 3 · THE DEAD FOREST', boss: 'Thornhart', bossSprite: 'thornhart', minion: 'Hollow Crow', minionSprite: 'hollow-crow', colors: ['#141e1a', '#3a4a30', '#b0ff60'] },
  l4: { id: 'l4', level: 4, name: 'The Frozen Peaks', card: 'LEVEL 4 · THE FROZEN PEAKS', boss: 'Yeti', bossSprite: 'yeti', minion: 'Frost Imp', minionSprite: 'frost-imp', colors: ['#4a5e7a', '#8ab4e0', '#ffffff'] },
  l5: { id: 'l5', level: 5, name: 'The Burning Heart', card: 'LEVEL 5 · THE BURNING HEART', boss: 'Phoenix', bossSprite: 'phoenix', minion: 'Cinder Slug', minionSprite: 'cinder-slug', colors: ['#2a1230', '#a0301e', '#ffb030'] },
  summit: { id: 'summit', level: 'summit', name: 'The Cloudy Summit', card: 'THE SUMMIT · THE STORM BREAKS', boss: 'Retep', bossSprite: 'retep', minion: 'Retep', minionSprite: 'retep', colors: ['#3a3e3a', '#7a8090', '#d4a820'] },
}

export const DRAGON = {
  name: 'Retep',
  title: 'RETEP, THE FINAL STORM',
  memoryCallout: 'This one again...',
  otherLecture: 'From another lecture',
  entrance: (name: string) => `So, ${name}, you made it through the storm...`,
}

/** Maps an enemy name from the server to a sprite id (unknown names fall back by biome). */
export const ENEMY_SPRITES: Record<string, string> = {
  minotaur: 'minotaur',
  hydra: 'hydra',
  kraken: 'hydra',
  thornhart: 'thornhart',
  'forest beast': 'thornhart',
  yeti: 'yeti',
  phoenix: 'phoenix',
  dragon: 'retep',
  retep: 'retep',
  torchmite: 'torchmite',
  brinecrab: 'brinecrab',
  'hollow crow': 'hollow-crow',
  'frost imp': 'frost-imp',
  'cinder slug': 'cinder-slug',
}

/** Display names for enemies the server still calls by their old names. */
export const ENEMY_NAMES: Record<string, string> = {
  kraken: 'Hydra',
  'forest beast': 'Thornhart',
  dragon: 'Retep',
}

export function enemyName(raw: string | undefined): string {
  if (!raw) return '???'
  return ENEMY_NAMES[raw.toLowerCase()] ?? raw
}

export const ITEMS: Record<string, { name: string; desc: string; icon: string }> = {
  split_rune: { name: 'Split Rune', desc: 'Removes two wrong answers.', icon: 'item-split_rune' },
  fifty_fifty: { name: 'Split Rune', desc: 'Removes two wrong answers.', icon: 'item-split_rune' },
  sages_whisper: { name: "Sage's Whisper", desc: 'A hint from the slides.', icon: 'item-sages_whisper' },
  hint: { name: "Sage's Whisper", desc: 'A hint from the slides.', icon: 'item-sages_whisper' },
  heartstone: { name: 'Heartstone', desc: 'Restores one heart.', icon: 'item-heartstone' },
  extra_heart: { name: 'Heartstone', desc: 'Restores one heart.', icon: 'item-heartstone' },
  aegis_ward: { name: 'Aegis Ward', desc: 'Blocks the next hit.', icon: 'item-aegis_ward' },
  shield: { name: 'Aegis Ward', desc: 'Blocks the next hit.', icon: 'item-aegis_ward' },
}

export function itemInfo(id: string, serverName?: string) {
  const known = ITEMS[id]
  return { name: serverName ?? known?.name ?? id, desc: known?.desc ?? '', icon: known?.icon ?? 'item-unknown' }
}

export const NODE_INFO: Record<string, { label: string; icon: string; help: string }> = {
  enemy: { label: 'Enemy', icon: 'node-enemy', help: 'A quick fight: two questions.' },
  miniboss: { label: 'Mini boss', icon: 'node-miniboss', help: 'The guardian of this subtopic.' },
  treasure: { label: 'Treasure', icon: 'node-treasure', help: 'Pick one power-up.' },
  blitz: { label: 'Blitz', icon: 'node-blitz', help: '4 questions, 10 seconds each.' },
  boss: { label: 'Retep', icon: 'node-boss', help: 'The dragon: the whole topic.' },
}

export const FORGE_CAPTIONS = [
  'Reading your slides...',
  'Finding the subtopics...',
  'Sharpening the questions...',
  'Waking the beasts...',
  'Raising Mount Cram...',
]

export const LINES = {
  dusty: 'THE CARTRIDGE IS DUSTY... try again',
  loading: 'The mountain stirs...',
  approach: 'Something approaches...',
  defeat: 'THE MOUNTAIN WINS... FOR NOW',
  victory: 'THE STORM IS BROKEN!',
  replay: 'REPLAY TO TRAIN THESE',
  namePrompt: 'WHAT IS YOUR NAME, CLIMBER?',
  emptyShelf: 'The shelf is bare. Insert a cartridge!',
  insert: 'INSERT CARTRIDGE',
  hit: 'HIT!',
  miss: 'OUCH!',
  blocked: 'WARDED!',
  timeout: "TIME'S UP!",
  slain: 'DEFEATED!',
  noTrace: 'No trace in this response.',
}

export const MANUAL = [
  {
    title: 'CARTRIDGES',
    body: [
      'Upload your lecture slides as a PDF. They become a cartridge on your shelf.',
      'Each subtopic in your notes becomes one level of Mount Cram.',
      'Replay a cartridge any time: it remembers what you got wrong.',
    ],
  },
  {
    title: 'FIGHTS',
    body: [
      'Every attack is a question from YOUR slides.',
      'Right answer: you strike. Wrong answer: the enemy strikes back.',
      'Then it quotes the exact slide you missed, with a one-line explanation.',
      'Your hearts carry across the whole climb.',
    ],
  },
  {
    title: 'THE MAP',
    nodes: true,
    body: ['The mountain picks your path. Stumble on a subtopic and the path bends back to train it.'],
  },
  {
    title: 'SCORING',
    body: [
      'Correct answers, hearts left and beating Retep all add to your score.',
      'Blitz answers score a bonus.',
      'Your results show your weak spots: replay to train them.',
    ],
  },
]

/**
 * The tracks the team picked as the mood for each level. The game's music is our own
 * chiptune (src/game/songs.ts) written to match these moods; these tracks are not used.
 */
export const MUSIC_MOODS: Record<string, { title: string; artist: string }> = {
  title: { title: 'The Throne is Mine', artist: 'Ruiqi Zhao' },
  level1: { title: 'At All Costs', artist: 'Dream Cave' },
  level2: { title: 'A Sinking Ship', artist: 'Wendel Scherer' },
  level3: { title: 'The End is Nigh', artist: 'Max Anson' },
  level4: { title: 'Anomaly', artist: 'Christoffer Moe Ditlevsen' },
  level5: { title: 'Howling Hell', artist: 'Jon Bjork' },
  summit: { title: 'Epic Triumph', artist: 'Elm Lake' },
}
