import { build, ellipse, path, poly, rect, seg } from '../pixel'

// Ramps are [outline, dark, mid, light, highlight]; light comes from the top-left.

/** QUILL: a hooded scholar-knight with a quill-blade and a book shield. Faces right. 32x32. */
export const player = build(
  'player',
  32,
  32,
  4,
  (p, pal, f) => {
    const cloak = pal.mat(['#141433', '#26265e', '#363a8c', '#4f5bb8', '#7a8ae0'])
    const skin = pal.mat(['#3a1f1a', '#8a5a44', '#c48a64', '#e8b48a', '#f4d0a8'])
    const book = pal.mat(['#2a0a10', '#6a1424', '#9a2234', '#c83a46', '#e86a66'])
    const gold = pal.mat(['#4a2c08', '#a06a14', '#d4a020', '#f0d050', '#fff0a0'])
    const blade = pal.mat(['#1a2230', '#7088a0', '#b0c4d4', '#e0ecf4', '#ffffff'])
    const boot = pal.mat(['#1a100a', '#3a2414', '#5a3a20', '#7a5230', '#9a6a40'])
    const attack = f === 2
    const hurt = f === 3
    const b = f === 1 ? 1 : 0 // idle breathing bob
    const lean = attack ? 1 : hurt ? -1 : 0

    p.fill(rect(10, 28, 4, 3), boot).fill(rect(17, 28, 4, 3), boot)
    // quill-blade (behind the hand)
    if (attack) {
      p.fill(seg(20, 19 + b, 31, 17, 1), blade)
      p.fill(poly([24, 15], [31, 13], [29, 17], [25, 18]), blade, { noHi: true })
    } else {
      p.fill(seg(21, 20 + b, 27 + lean, 7, 0.9), blade)
      p.fill(poly([25 + lean, 13], [30 + lean, 2], [28 + lean, 12], [26 + lean, 15]), blade, { noHi: true })
    }
    // cloak body and hood
    p.fill(poly([10 + lean, 14 + b], [21 + lean, 14 + b], [23, 29], [8, 29]), cloak, { edge: false })
    p.fill(poly([9 + lean, 9 + b], [12 + lean, 4 + b], [13 + lean, 12 + b]), cloak)
    p.fill(ellipse(15.5 + lean, 10.5 + b, 6, 6.5), cloak)
    p.fill(ellipse(17.5 + lean, 11.5 + b, 3, 3.5), skin, { flat: 'd' })
    p.fill(rect(9 + lean, 22 + b, 13, 1), gold, { flat: 'm' })
    // eyes glinting under the hood
    if (hurt) p.dots([[16 + lean, 11 + b], [18 + lean, 12 + b], [18 + lean, 11 + b], [16 + lean, 12 + b]], skin.o)
    else p.dots([[17 + lean, 11 + b], [19 + lean, 11 + b]], blade.h)
    // hand on the quill
    p.fill(ellipse(21.5 + lean, 20.5 + b, 1.6, 1.6), skin)
    // book shield on the near arm
    p.fill(rect(5 + lean, 16 + b, 7, 9), book, { edge: true })
    p.fill(rect(6 + lean, 17 + b, 5, 7), book)
    p.fill(rect(7 + lean, 19 + b, 3, 3), gold)
    p.dot(5 + lean, 16 + b, gold.l).dot(11 + lean, 24 + b, gold.d)
    p.outline().clean()
  },
  { idle: [0, 1], attack: [2], hurt: [3] },
)

/** Minotaur: horns and a double-headed labyrinth axe. Faces left. 64x64. */
export const minotaur = build(
  'minotaur',
  64,
  64,
  4,
  (p, pal, f) => {
    const fur = pal.mat(['#24120a', '#5a2e16', '#844422', '#ac6232', '#d08a50'])
    const muzzle = pal.mat(['#3a2014', '#8a5a3a', '#b07a52', '#d09a6c', '#e8b88a'])
    const horn = pal.mat(['#3a3020', '#9a8a68', '#cfc09a', '#ece0c0', '#fffbe8'])
    const steel = pal.mat(['#14161e', '#3e4656', '#6a7486', '#9aa4b4', '#d4dae4'])
    const wood = pal.mat(['#1e1008', '#4a2c14', '#6a4220', '#8a5a2c', '#aa7840'])
    const cloth = pal.mat(['#2a0806', '#6a1410', '#9a2418', '#c03a22', '#e06a3a'])
    const eye = pal.char('#ff3a1a')
    const eyeHi = pal.char('#ffd040')
    const b = f % 2 === 1 ? 1 : 0
    const atk = f === 2 ? -3 : 0
    // axe behind, held by the far arm
    p.fill(seg(50, 60, 50 + atk, 9 + b, 1.3), wood)
    p.fill(poly([50 + atk, 11 + b], [41 + atk, 6 + b], [40 + atk, 22 + b], [50 + atk, 19 + b]), steel, { edge: true })
    p.fill(poly([50 + atk, 11 + b], [59 + atk, 6 + b], [60 + atk, 22 + b], [50 + atk, 19 + b]), steel, { edge: true })
    p.fill(poly([50 + atk, 12 + b], [42 + atk, 8 + b], [41 + atk, 21 + b], [50 + atk, 18 + b]), steel)
    p.fill(poly([50 + atk, 12 + b], [58 + atk, 8 + b], [59 + atk, 21 + b], [50 + atk, 18 + b]), steel)
    // labyrinth (meander) marks on both blades
    for (const sx of [44, 53]) {
      p.dots([[sx + atk, 12 + b], [sx + 1 + atk, 12 + b], [sx + 2 + atk, 12 + b], [sx + 2 + atk, 13 + b], [sx + 2 + atk, 14 + b], [sx + 1 + atk, 14 + b], [sx + atk, 14 + b], [sx + atk, 15 + b], [sx + atk, 16 + b], [sx + 1 + atk, 16 + b], [sx + 2 + atk, 16 + b]], steel.o)
    }
    p.fill(seg(42, 28 + b, 49 + atk, 38, 3.2), fur)
    p.fill(ellipse(49 + atk, 38.5, 2.8, 2.8), fur)
    // legs and hooves
    p.fill(ellipse(26, 48, 6, 8), fur).fill(ellipse(40, 48, 6, 8), fur)
    p.fill(rect(20, 55, 9, 7), horn, { flat: 'd' }).fill(rect(35, 55, 9, 7), horn, { flat: 'd' })
    // torso and loincloth
    p.fill(ellipse(33, 34 + b, 14, 13), fur)
    p.fill(ellipse(30, 30 + b, 6, 4), fur, { flat: 'l' })
    p.fill(poly([21, 42 + b], [45, 42 + b], [42, 53], [24, 53]), cloth)
    p.fill(rect(21, 42 + b, 24, 2), horn, { flat: 'd' })
    // head
    const hx = atk
    p.fill(ellipse(23 + hx, 20 + b, 9, 8), fur)
    p.fill(ellipse(30 + hx, 16 + b, 3, 2), fur)
    p.fill(ellipse(15 + hx, 24 + b, 5.5, 4.5), muzzle)
    p.dots([[12 + hx, 24 + b], [15 + hx, 25 + b]], fur.o)
    p.fill(ellipse(13.5 + hx, 28.5 + b, 2.2, 1.6), horn, { flat: 'o' })
    p.dot(13 + hx, 28 + b, '.').dot(14 + hx, 28 + b, '.')
    p.fill(ellipse(13.5 + hx, 28.5 + b, 2.2, 1.6), { o: horn.o, d: eyeHi, m: eyeHi, l: eyeHi, h: eyeHi }, { edge: true })
    // horns
    p.fill(path([[19 + hx, 15 + b], [11 + hx, 11 + b], [6 + hx, 5 + b], [7 + hx, 1 + b]], 2.6, 0.8), horn)
    p.fill(path([[27 + hx, 13 + b], [34 + hx, 7 + b], [33 + hx, 1 + b]], 2.2, 0.8), horn)
    // eyes
    p.dots([[19 + hx, 19 + b], [20 + hx, 19 + b]], eye).dot(19 + hx, 18 + b, eyeHi)
    // near arm
    p.fill(seg(24, 30 + b, 17 + atk, 40, 3.6, 3), fur, { edge: false })
    p.fill(ellipse(16 + atk, 41, 3, 3), muzzle)
    p.outline().clean()
  },
  { idle: [0, 1], attack: [2, 2], hurt: [3] },
)

/** Hydra: three heads above stormy waves. Faces left. 64x64. */
export const hydra = build(
  'hydra',
  64,
  64,
  3,
  (p, pal, f) => {
    const scale = pal.mat(['#06201c', '#0e4a40', '#16705e', '#26a080', '#6ad4b0'])
    const belly = pal.mat(['#2a3010', '#8a9a40', '#b8c460', '#dce490', '#f4f8c0'])
    const fin = pal.mat(['#1a0a2a', '#4a1a6a', '#6a2a94', '#9046c0', '#b878e0'])
    const sea = pal.mat(['#020a1c', '#0a1e44', '#12306a', '#1c4a94', '#3a6ac0'])
    const foam = pal.char('#e8f4ff')
    const eye = pal.char('#ffe040')
    const mouth = pal.char('#2a0410')
    const fang = pal.char('#ffffff')
    const s = f === 1 ? 1 : f === 2 ? -1 : 0
    const heads: [number, number, [number, number][]][] = [
      [32 + s, 12, [[36, 52], [36, 36], [33 + s, 22], [32 + s, 14]]],
      [12 - s, 26 + s, [[28, 54], [22, 44], [16 - s, 34], [13 - s, 28 + s]]],
      [50, 22 - s, [[46, 52], [52, 40], [53, 30 - s], [51, 24 - s]]],
    ]
    p.fill(ellipse(36, 56, 20, 10), scale)
    for (const [, , pts] of heads) {
      p.fill(path(pts, 4.6, 3.2), scale)
      p.fill(path(pts.map(([x, y]) => [x - 2, y + 1] as [number, number]), 1.6, 1.1), belly, { flat: 'm' })
    }
    for (const [x, y] of heads) {
      p.fill(poly([x + 1, y - 3], [x + 5, y - 8], [x + 5, y - 2]), fin)
      p.fill(poly([x + 3, y - 1], [x + 8, y - 4], [x + 6, y + 1]), fin)
      p.fill(ellipse(x + 1, y + 0.5, 5, 4), scale)
      p.fill(poly([x - 2, y - 3], [x - 10, y], [x - 9, y + 1], [x - 2, y + 1]), scale)
      p.fill(poly([x - 2, y + 2], [x - 9, y + 4], [x - 1, y + 5]), scale)
      p.dots([[x - 9, y + 2], [x - 8, y + 2], [x - 7, y + 2], [x - 6, y + 2], [x - 5, y + 2], [x - 4, y + 2], [x - 3, y + 2]], mouth)
      p.dots([[x - 7, y + 1], [x - 4, y + 1], [x - 6, y + 3]], fang)
      p.dot(x - 1, y - 1, eye).dot(x, y - 1, scale.o)
    }
    // stormy waves
    p.fill((x, y) => y >= 55 + Math.round(1.6 * Math.sin(x / 4 + f * 1.4)), sea)
    for (let x = 0; x < 64; x++) {
      const y = 55 + Math.round(1.6 * Math.sin(x / 4 + f * 1.4))
      if ((x + f * 3) % 7 < 4) p.dot(x, y, foam)
    }
    p.outline().clean()
  },
  { idle: [0, 1, 0, 2], attack: [1], hurt: [2] },
)

/** Thornhart: an antlered creature of dead wood and thorns with a glowing heart-knot. 64x64. */
export const thornhart = build(
  'thornhart',
  64,
  64,
  3,
  (p, pal, f) => {
    const bark = pal.mat(['#0e0c0a', '#2a241e', '#423a30', '#5e5244', '#80725e'])
    const bone = pal.mat(['#2a2a26', '#7a7a70', '#aeac9e', '#d4d2c4', '#f0eee4'])
    const heart = pal.mat(['#1a2a08', '#4a8a10', '#8ad020', '#c8f050', '#ffffc0'])
    const moss = pal.char('#3a6a2a')
    const thorn = pal.char('#141a10')
    const glow = pal.char('#b0ff60')
    const b = f === 1 ? 1 : 0
    // legs
    p.fill(path([[26, 44], [22, 54], [24, 62]], 2.8, 2), bark)
    p.fill(path([[38, 44], [42, 54], [40, 62]], 2.8, 2), bark)
    // torso: twisted wood with a cavity
    p.fill(poly([22, 22 + b], [41, 21 + b], [43, 45], [24, 47]), bark)
    p.fill(ellipse(32, 33 + b, 6.5, 6), { o: bark.o, d: bark.o, m: bark.o, l: bark.o, h: bark.o })
    for (const y of [27, 31, 35, 39]) p.fill(seg(25, y + b, 29, y + 1 + b, 0.6), bark, { flat: 'l' })
    p.fill(ellipse(32, 33 + b, f === 2 ? 4.6 : 3.8, f === 2 ? 4.6 : 3.8), heart)
    p.dot(31, 32 + b, heart.h)
    if (f === 2) p.dots([[26, 33 + b], [38, 33 + b], [32, 27 + b], [32, 39 + b]], glow)
    // neck and stag skull
    p.fill(seg(29, 23 + b, 22, 15 + b, 3), bark)
    p.fill(poly([13, 11 + b], [25, 8 + b], [28, 13 + b], [20, 18 + b], [9, 16 + b]), bone)
    p.dots([[17, 12 + b], [18, 12 + b]], glow).dot(17, 13 + b, heart.l)
    p.dots([[10, 15 + b], [12, 16 + b]], bone.o)
    // antlers of dead branches
    const ant: [[number, number][], number][] = [
      [[[20, 9 + b], [16, 4 + b], [12, 0]], 1.4],
      [[[16, 4 + b], [9, 3 + b], [5, 0]], 1],
      [[[17, 6 + b], [11, 7 + b], [6, 5 + b]], 0.9],
      [[[23, 8 + b], [27, 3 + b], [30, 0]], 1.4],
      [[[26, 4 + b], [33, 3 + b], [37, 1]], 1],
    ]
    for (const [pts, r] of ant) p.fill(path(pts, r, 0.7), bark)
    // long arms with thorn claws
    p.fill(path([[24, 25 + b], [16, 34 + b], [12, 43]], 2.2, 1.6), bark)
    p.fill(path([[40, 25 + b], [46, 34 + b], [48, 43]], 2, 1.4), bark)
    p.dots([[10, 45], [11, 46], [13, 46], [9, 44], [47, 45], [49, 46]], thorn)
    // thorns and moss
    p.dots([[21, 26], [20, 32], [44, 30], [45, 36], [23, 44], [42, 46], [21, 52], [43, 52]], thorn)
    p.dots([[36, 23 + b], [37, 23 + b], [27, 45], [28, 46]], moss)
    p.outline().clean()
  },
  { idle: [0, 1, 0, 2], attack: [2], hurt: [1] },
)

/** Yeti: frost-crusted fur. Faces left. 64x64. */
export const yeti = build(
  'yeti',
  64,
  64,
  3,
  (p, pal, f) => {
    const fur = pal.mat(['#2a3a50', '#8aa4c4', '#c4d6ec', '#e8f2fc', '#ffffff'])
    const face = pal.mat(['#101c2c', '#2a4460', '#40648a', '#5a84b0', '#7aa4d0'])
    const ice = pal.char('#a0e4ff')
    const mouth = pal.char('#1a0a14')
    const fang = pal.char('#ffffff')
    const eye = pal.char('#0a1020')
    const b = f === 1 ? 1 : 0
    const atk = f === 2 ? -3 : 0
    p.fill(ellipse(24, 57, 7, 5), fur).fill(ellipse(41, 57, 7, 5), fur)
    p.fill(seg(48, 30 + b, 53, 47, 5, 4.5), fur)
    p.fill(ellipse(53, 50, 5, 4), face)
    p.fill(ellipse(33, 38 + b, 18, 18), fur)
    // shaggy edge
    for (let i = 0; i < 9; i++) p.fill(ellipse(18 + i * 4, 54 + (i % 2), 2.6, 3), fur)
    p.fill(ellipse(27 + atk, 18 + b, 10.5, 9.5), fur)
    p.fill(ellipse(21 + atk, 20 + b, 6.2, 5.4), face)
    p.dots([[18 + atk, 19 + b], [22 + atk, 19 + b]], eye).dots([[18 + atk, 18 + b], [22 + atk, 18 + b]], fang)
    p.fill(rect(17 + atk, 23 + b, 7, 2), { o: mouth, d: mouth, m: mouth, l: mouth, h: mouth }, { flat: 'm' })
    p.dots([[18 + atk, 23 + b], [22 + atk, 23 + b]], fang)
    p.fill(poly([30 + atk, 10 + b], [33 + atk, 4 + b], [35 + atk, 11 + b]), face)
    p.fill(seg(18, 30 + b, 11 + atk, 47, 5.2, 4.6), fur)
    p.fill(ellipse(10 + atk, 50, 5.2, 4.2), face)
    // frost crust: icicles and sparkles
    for (const [x, y] of [[20, 44], [26, 52], [38, 53], [46, 44], [14, 40], [52, 42]] as [number, number][]) {
      p.dot(x, y + b, ice).dot(x, y + 1 + b, ice)
    }
    p.dots([[28 + atk, 12 + b], [36, 26 + b], [42, 34 + b], [24, 32 + b]].filter((_, i) => (i + f) % 2 === 0) as [number, number][], ice)
    p.outline().clean()
  },
  { idle: [0, 1], attack: [2], hurt: [1] },
)

/** Phoenix: ember wings and a flowing flame tail. Faces left. 64x64. */
export const phoenix = build(
  'phoenix',
  64,
  64,
  3,
  (p, pal, f) => {
    const flame = pal.mat(['#3a0a06', '#a01a0a', '#e0441a', '#ff8a2a', '#ffd060'])
    const ember = pal.mat(['#2a0604', '#6a1008', '#8a1a0c', '#b8300e', '#e05020'])
    const beak = pal.mat(['#3a2408', '#a06a14', '#e0a020', '#f8d050', '#fff0a0'])
    const white = pal.char('#fff8e0')
    const eye = pal.char('#1a0a00')
    const w = f === 1 ? 4 : f === 2 ? -2 : 0
    p.fill(poly([36, 40], [46, 62], [39, 55], [34, 63], [30, 53], [25, 60], [29, 40]), flame)
    p.fill(poly([36, 27], [60, 4 + w], [56, 17 + w], [63, 22 + w], [50, 30], [40, 36]), ember)
    p.fill(ellipse(34, 32, 8, 10), flame)
    p.fill(poly([30, 28], [5, 8 + w], [14, 23 + w], [3, 29 + w], [22, 36], [31, 38]), flame)
    for (const [x0, y0] of [[24, 30], [18, 26], [12, 22]] as [number, number][])
      p.fill(seg(x0, y0, x0 - 8, y0 - 8 + w, 0.6), ember, { flat: 'm' })
    p.fill(ellipse(24, 20, 5.5, 5), flame)
    p.fill(poly([20, 18], [13, 22], [20, 23]), beak)
    p.dot(22, 19, eye).dot(23, 18, white)
    p.fill(poly([25, 16], [22, 5 + (f % 2)], [28, 15]), flame)
    p.fill(poly([28, 17], [32, 7], [31, 18]), flame)
    p.fill(poly([22, 16], [16, 9 + (f % 2)], [23, 18]), flame)
    p.dots([[33, 31], [35, 34], [31, 35]], white)
    const sparks: [number, number][] = f === 0 ? [[8, 40], [50, 44], [20, 50]] : f === 1 ? [[10, 36], [54, 40], [18, 56]] : [[6, 44], [48, 48], [22, 46]]
    p.dots(sparks, flame.h)
    p.outline().clean()
  },
  { idle: [0, 1, 0, 2], attack: [1], hurt: [2] },
)

/** Retep, the Final Storm: violet and storm-blue scales, two swept horns, storm-membrane wings, lightning. 96x96. */
export const retep = build(
  'retep',
  96,
  96,
  4,
  (p, pal, f) => {
    const scale = pal.mat(['#140a2e', '#2e1a6a', '#4a2a9e', '#6e4ad0', '#a888f4'])
    const belly = pal.mat(['#06183a', '#1a4a8e', '#2a78c8', '#5ab4f0', '#b4ecff'])
    const horn = pal.mat(['#2a2010', '#a08040', '#d8b860', '#f0dc90', '#fffbe0'])
    const wing = pal.mat(['#0c0e24', '#232a5a', '#353f80', '#4e5ca8', '#7a8ad0'])
    const bolt = pal.char('#e8fcff')
    const boltC = pal.char('#60e0ff')
    const eye = pal.char('#ffe860')
    const mouth = pal.char('#14040e')
    const fang = pal.char('#ffffff')
    const b = f % 2 === 1 ? 1 : 0
    const atk = f === 3 ? -4 : 0
    const w = f === 1 ? 2 : f === 2 ? -1 : 0 // wing beat
    // ---- wing (behind the body): raised high and swept back, five fingers, scalloped membrane
    const wr: [number, number] = [58, 9 + b - w]
    const tips: [number, number][] = [[50, 1 + b - w * 2], [72, 0 + b - w * 2], [92, 5 + b - w], [95, 28 + b], [90, 47 + b]]
    p.fill(
      poly([44, 48 + b], [50, 28 + b], wr, tips[0], [61, 8 + b - w], tips[1], [80, 10 + b - w], tips[2], [87, 20 + b], tips[3], [85, 37 + b], tips[4], [70, 54 + b]),
      wing,
    )
    p.fill(seg(46, 46 + b, wr[0], wr[1], 2.6, 1.8), scale)
    for (const t of tips) p.fill(seg(wr[0], wr[1], t[0], t[1], 1.2, 0.6), scale, { flat: 'd' })
    p.dots(tips.map(([x, y]) => [x, Math.max(0, y - 1)] as [number, number]), horn.l)
    // ---- tail
    p.fill(path([[72, 66], [86, 72], [91, 84], [84, 92]], 5.5, 1.8), scale)
    p.fill(poly([84, 89], [76, 94], [86, 95], [90, 90]), belly)
    // ---- hind leg
    p.fill(ellipse(67, 69, 10, 11), scale)
    p.fill(path([[70, 74], [74, 82], [71, 88]], 4.6, 3.6), scale)
    p.fill(poly([62, 87], [76, 86], [78, 91], [60, 91]), scale)
    p.dots([[59, 91], [62, 91], [65, 91]], horn.l).dots([[59, 90], [62, 90], [65, 90]], horn.m)
    // ---- body, belly plates, spine
    p.fill(ellipse(54, 58 + b, 22, 16), scale)
    p.fill(ellipse(47, 63 + b, 13, 9), belly)
    for (const y of [57, 61, 65, 69]) p.fill(seg(37, y + b, 57, y + b, 0.5), belly, { flat: 'd' })
    for (const x of [50, 58, 66]) p.fill(poly([x - 3, 44 + b], [x, 38 + b], [x + 3, 44 + b]), belly)
    // ---- neck
    p.fill(path([[42 + atk, 50 + b], [32 + atk, 36 + b], [26 + atk, 26 + b]], 8, 6), scale)
    for (const [x, y] of [[36, 46], [31, 39]] as [number, number][]) p.fill(seg(x - 4 + atk, y + 2 + b, x + 1 + atk, y + 4 + b, 0.6), belly, { flat: 'm' })
    // ---- two swept-back horns (the far one first)
    const hx = atk
    p.fill(path([[19 + hx, 16 + b], [24 + hx, 8 + b], [31 + hx, 3 + b]], 2, 0.6), horn)
    p.fill(path([[24 + hx, 17 + b], [31 + hx, 10 + b], [39 + hx, 7 + b]], 2.6, 0.7), horn)
    // ---- head: rounded skull, long snout, open jaw, glowing eye
    p.fill(ellipse(22 + hx, 22 + b, 10, 7.5), scale)
    p.fill(poly([14 + hx, 17 + b], [2 + hx, 23 + b], [3 + hx, 27 + b], [16 + hx, 26 + b]), scale)
    p.fill(poly([15 + hx, 27 + b], [4 + hx, 29 + b], [5 + hx, 32 + b], [18 + hx, 31 + b]), scale)
    p.fill(rect(4 + hx, 27 + b, 12, 2), { o: mouth, d: mouth, m: mouth, l: mouth, h: mouth }, { flat: 'm' })
    p.dots([[6 + hx, 27 + b], [9 + hx, 27 + b], [12 + hx, 28 + b], [7 + hx, 28 + b]], fang)
    p.dot(4 + hx, 23 + b, scale.o)
    p.dots([[19 + hx, 19 + b], [20 + hx, 19 + b], [21 + hx, 19 + b]], eye).dot(20 + hx, 18 + b, belly.h)
    // ---- fore leg
    p.fill(ellipse(43, 65 + b, 6.5, 7), scale)
    p.fill(path([[42, 68 + b], [39, 79], [37, 87]], 4.4, 3.4), scale)
    p.fill(poly([29, 87], [42, 86], [43, 91], [27, 91]), scale)
    p.dots([[26, 91], [29, 91], [32, 91]], horn.l).dots([[26, 90], [29, 90], [32, 90]], horn.m)
    p.outline().clean()
    // ---- lightning flickers along the body and wing (different every frame)
    const bolts: [number, number][][] = [
      [[34, 52], [40, 56], [38, 60], [46, 62], [44, 68]],
      [[60, 46], [56, 52], [62, 54], [58, 60], [64, 64]],
      [[72, 18], [66, 26], [74, 28], [66, 38]],
      [[56, 66], [60, 70], [56, 72], [62, 76]],
    ]
    for (const pts of [bolts[f % 4], bolts[(f + 2) % 4]]) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i]
        const [x1, y1] = pts[i + 1]
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
        for (let k = 0; k <= n; k++) {
          const x = Math.round(x0 + ((x1 - x0) * k) / n)
          const y = Math.round(y0 + ((y1 - y0) * k) / n) + b
          p.set(x, y, k % 3 === 0 ? boltC : bolt)
        }
      }
    }
  },
  { idle: [0, 1, 2, 1], attack: [3], hurt: [2] },
)
