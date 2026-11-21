import { build, ellipse, literal, path, poly, rect, seg } from '../pixel'

// Hearts are hand-drawn; the rest use the painter.

const HEART_PAL = { o: '#2a0408', r: '#d8202a', l: '#ff6a5a', h: '#ffd0c0', e: '#4a3a44', g: '#6a5a64' }
export const heart = literal('heart', HEART_PAL, [
  [
    '.oo..oo.',
    'ohlrorro',
    'olrrrrro',
    'orrrrrro',
    '.orrrro.',
    '..orro..',
    '...oo...',
    '........',
  ],
  [
    '.oo..oo.',
    'ohlroggo',
    'olrrogeo',
    'orrrogeo',
    '.orrogo.',
    '..orgo..',
    '...oo...',
    '........',
  ],
  [
    '.oo..oo.',
    'oggoogeo',
    'ogeeeeeo',
    'oeeeeeeo',
    '.oeeeeo.',
    '..oeeo..',
    '...oo...',
    '........',
  ],
], { full: [0], half: [1], empty: [2] })

// ---- item icons, 12x12

export const splitRune = build('item-split_rune', 12, 12, 1, (p, pal) => {
  const stone = pal.mat(['#1a1a24', '#4a4a5c', '#70708a', '#9a9ab4', '#c8c8dc'])
  const rune = pal.char('#60e0ff')
  p.fill(poly([2, 1], [9, 1], [10, 10], [1, 10]), stone)
  p.dots([[5, 3], [5, 4], [6, 5], [5, 6], [6, 7], [6, 8], [4, 5], [7, 5]], rune)
  p.fill(seg(6, 1, 5, 10, 0.4), stone, { flat: 'o' })
  p.outline()
})

export const sagesWhisper = build('item-sages_whisper', 12, 12, 1, (p, pal) => {
  const paper = pal.mat(['#3a2a10', '#b09060', '#e0c890', '#f4e4b8', '#fffbe8'])
  const ink = pal.char('#4a2a8a')
  p.fill(rect(2, 2, 8, 8), paper)
  p.fill(ellipse(2, 6, 1.5, 4.5), paper).fill(ellipse(10, 6, 1.5, 4.5), paper)
  p.dots([[4, 4], [5, 4], [6, 4], [7, 4], [4, 6], [5, 6], [6, 6], [4, 8], [5, 8], [6, 8], [7, 8]], ink)
  p.outline()
})

export const heartstone = build('item-heartstone', 12, 12, 1, (p, pal) => {
  const gem = pal.mat(['#2a0410', '#8a1030', '#c8204a', '#f05a7a', '#ffd0dc'])
  p.fill(poly([6, 11], [1, 5], [3, 2], [6, 4], [9, 2], [11, 5]), gem)
  p.outline()
})

export const aegisWard = build('item-aegis_ward', 12, 12, 1, (p, pal) => {
  const steel = pal.mat(['#101a2a', '#3a5070', '#5a80a8', '#8ab4dc', '#d0ecff'])
  const gold = pal.char('#f0c040')
  p.fill(poly([1, 1], [10, 1], [10, 6], [5.5, 11], [1, 6]), steel)
  p.dots([[5, 3], [5, 4], [5, 5], [5, 6], [4, 4], [6, 4]], gold)
  p.outline()
})

export const itemUnknown = build('item-unknown', 12, 12, 1, (p, pal) => {
  const sack = pal.mat(['#2a1a08', '#6a4a20', '#9a7034', '#c09650', '#e0c080'])
  const tie = pal.char('#d04020')
  p.fill(ellipse(6, 7.5, 4.5, 4), sack).fill(poly([4, 1], [8, 1], [7, 4], [5, 4]), sack)
  p.dots([[4, 4], [5, 4], [6, 4], [7, 4]], tie)
  p.outline()
})

// ---- map node icons, 16x16

export const nodeEnemy = build('node-enemy', 16, 16, 1, (p, pal) => {
  const steel = pal.mat(['#101420', '#5a6478', '#9aa4b8', '#cad2e0', '#ffffff'])
  const hilt = pal.mat(['#2a1408', '#6a3a14', '#9a5a20', '#c88030', '#f0b050'])
  p.fill(seg(3, 3, 11, 11, 0.8), steel).fill(seg(13, 3, 5, 11, 0.8), steel)
  p.fill(seg(9, 13, 13, 9, 0.7), hilt).fill(seg(3, 9, 7, 13, 0.7), hilt)
  p.outline()
})

export const nodeMiniboss = build('node-miniboss', 16, 16, 1, (p, pal) => {
  const bone = pal.mat(['#1a1a14', '#8a8a78', '#c8c8b4', '#e8e8d8', '#ffffff'])
  const eye = pal.char('#ff3a1a')
  p.fill(path([[5, 6], [2, 3], [2, 0]], 1.2, 0.6), bone).fill(path([[11, 6], [14, 3], [14, 0]], 1.2, 0.6), bone)
  p.fill(ellipse(8, 8, 5, 5), bone).fill(rect(5, 11, 6, 3), bone)
  p.dots([[6, 8], [10, 8]], eye).dots([[6, 13], [8, 13], [10, 13]], bone.o)
  p.outline()
})

export const nodeTreasure = build('node-treasure', 16, 16, 1, (p, pal) => {
  const wood = pal.mat(['#1e1008', '#5a3414', '#8a5220', '#b47030', '#d89848'])
  const gold = pal.mat(['#3a2404', '#a07010', '#e0b020', '#f8e060', '#fffbc0'])
  p.fill(rect(2, 7, 12, 7), wood).fill(ellipse(8, 7, 6, 3.5), wood)
  p.fill(rect(2, 8, 12, 1), gold, { flat: 'm' }).fill(rect(7, 7, 2, 4), gold)
  p.outline()
})

export const nodeBlitz = build('node-blitz', 16, 16, 1, (p, pal) => {
  const bolt = pal.mat(['#3a2a00', '#d0a000', '#f8d820', '#fff080', '#ffffff'])
  p.fill(poly([9, 0], [3, 9], [7, 9], [5, 15], [13, 6], [9, 6], [11, 0]), bolt)
  p.outline()
})

export const nodeBoss = build('node-boss', 16, 16, 1, (p, pal) => {
  const red = pal.mat(['#2a0608', '#7a1018', '#b81c24', '#e0402e', '#ff8060'])
  const horn = pal.char('#f0d060')
  const eye = pal.char('#fff060')
  p.fill(poly([2, 6], [12, 4], [15, 9], [10, 13], [2, 12]), red)
  p.fill(poly([1, 9], [-1, 11], [3, 13]), red)
  p.dots([[9, 3], [10, 2], [11, 1], [12, 3], [13, 2]], horn)
  p.dot(9, 7, eye)
  p.outline()
})

export const nodeCleared = build('node-cleared', 16, 16, 1, (p, pal) => {
  const pole = pal.mat(['#1a1008', '#5a3a1a', '#8a5a2a', '#aa7a3a', '#caa060'])
  const flag = pal.mat(['#08280c', '#1a7a2a', '#2aaa3a', '#5ad85a', '#b0ffb0'])
  p.fill(rect(4, 2, 2, 13), pole).fill(poly([6, 2], [14, 5], [6, 8]), flag)
  p.outline()
})

export const nodeLocked = build('node-locked', 16, 16, 1, (p, pal) => {
  const iron = pal.mat(['#0a0a10', '#3a3a48', '#5a5a6c', '#7e7e94', '#a8a8c0'])
  p.fill(path([[5, 8], [5, 4], [8, 2], [11, 4], [11, 8]], 1.2), iron)
  p.fill(rect(3, 7, 10, 7), iron)
  p.dots([[8, 9], [8, 10], [8, 11]], iron.o)
  p.outline()
})

export const nodeCurrent = build(
  'node-current',
  16,
  16,
  2,
  (p, pal, f) => {
    const gold = pal.mat(['#3a2404', '#c08a10', '#f8d020', '#fff080', '#ffffff'])
    p.fill(poly([3, 1 + f * 2], [13, 1 + f * 2], [8, 9 + f * 2]), gold)
    p.outline()
  },
  { idle: [0, 1] },
)

// ---- UI pieces

export const chest = build(
  'chest',
  32,
  28,
  2,
  (p, pal, f) => {
    const wood = pal.mat(['#1e1008', '#5a3414', '#8a5220', '#b47030', '#d89848'])
    const gold = pal.mat(['#3a2404', '#a07010', '#e0b020', '#f8e060', '#fffbc0'])
    const dark = pal.char('#120804')
    const shine = pal.char('#fffbd0')
    p.fill(rect(3, 14, 26, 13), wood)
    if (f === 0) {
      p.fill(ellipse(16, 14, 13, 7), wood).fill(rect(3, 13, 26, 2), gold, { flat: 'm' })
      p.fill(rect(14, 12, 4, 6), gold)
    } else {
      p.fill(poly([3, 13], [7, 1], [27, 1], [29, 13]), wood)
      p.fill(rect(5, 12, 22, 4), { o: dark, d: dark, m: dark, l: dark, h: dark }, { flat: 'm' })
      p.fill(ellipse(16, 13, 8, 3), gold)
      p.dots([[10, 6], [16, 3], [22, 7], [13, 9], [20, 4]], shine)
    }
    p.fill(rect(3, 20, 26, 2), gold, { flat: 'd' })
    p.outline()
  },
  { closed: [0], open: [1] },
)

export const cartridge = build('cartridge', 40, 44, 1, (p, pal) => {
  const shell = pal.mat(['#141420', '#3a3a52', '#56567a', '#7a7aa4', '#a4a4cc'])
  const label = pal.mat(['#4a3a20', '#d8c8a0', '#efe2c0', '#fbf3dc', '#ffffff'])
  const pin = pal.char('#e0b040')
  p.fill(poly([1, 1], [33, 1], [39, 7], [39, 43], [1, 43]), shell)
  p.fill(rect(5, 6, 30, 24), label, { flat: 'm' })
  p.fill(rect(5, 6, 30, 3), { o: pal.char('#b83a2a'), d: pal.char('#b83a2a'), m: pal.char('#d84a32'), l: pal.char('#e86a4a'), h: pal.char('#e86a4a') }, { flat: 'm' })
  for (let x = 6; x < 35; x += 3) p.fill(rect(x, 36, 2, 5), { o: pin, d: pin, m: pin, l: pin, h: pin }, { flat: 'm' })
  for (const y of [33, 34]) for (let x = 5; x < 35; x += 2) p.dot(x, y, shell.d)
  p.outline()
})

export const emptySlot = build('empty-slot', 40, 44, 2, (p, pal, f) => {
  const rim = pal.mat(['#0a0a12', '#1e1e2c', '#2a2a3c', '#3a3a50', '#4a4a64'])
  const plus = pal.char(f === 0 ? '#f8d020' : '#a08010')
  for (let i = 0; i < 40; i += 2) {
    p.dot(i, 0, rim.l).dot(i, 43, rim.l)
  }
  for (let j = 0; j < 44; j += 2) {
    p.dot(0, j, rim.l).dot(39, j, rim.l)
  }
  p.fill(rect(18, 14, 4, 14), { o: plus, d: plus, m: plus, l: plus, h: plus }, { flat: 'm' })
  p.fill(rect(13, 19, 14, 4), { o: plus, d: plus, m: plus, l: plus, h: plus }, { flat: 'm' })
}, { idle: [0, 0, 1, 1] })
