import { build, ellipse, path, poly, seg } from '../pixel'

// One regular enemy per biome. 32x32, facing left.

export const torchmite = build(
  'torchmite',
  32,
  32,
  3,
  (p, pal, f) => {
    const shell = pal.mat(['#1a0a04', '#4a1e0c', '#7a3414', '#a8521e', '#d88038'])
    const leg = pal.mat(['#140804', '#2a160a', '#3e2210', '#5a3418', '#7a4a22'])
    const wood = pal.mat(['#1e1008', '#4a2c14', '#6a4220', '#8a5a2c', '#aa7840'])
    const fire = pal.mat(['#5a1004', '#d0400a', '#ff8a1a', '#ffd040', '#fffbe0'])
    const eye = pal.char('#ffe040')
    const b = f === 1 ? 1 : 0
    for (const x of [12, 17, 22]) p.fill(seg(x, 24, x - 2, 29, 0.8), leg)
    p.fill(seg(6, 22 + b, 3, 9, 0.9), wood)
    p.fill(ellipse(3.5, 7 + b - (f === 2 ? 1 : 0), 2.6, 3.4 + (f === 2 ? 1 : 0)), fire)
    p.fill(ellipse(17, 21 + b, 9, 6), shell)
    p.fill(seg(17, 15 + b, 17, 27 + b, 0.5), shell, { flat: 'o' })
    p.fill(ellipse(8, 22 + b, 4, 3.6), leg)
    p.fill(path([[6, 19 + b], [4, 16 + b], [2, 15 + b]], 0.6), leg)
    p.dot(6, 21 + b, eye)
    p.outline().clean()
  },
  { idle: [0, 1, 0, 2], attack: [2], hurt: [1] },
)

export const brinecrab = build(
  'brinecrab',
  32,
  32,
  2,
  (p, pal, f) => {
    const shell = pal.mat(['#2a0806', '#7a1e10', '#b83a1a', '#e0602a', '#f89050'])
    const barnacle = pal.mat(['#3a3a30', '#8a8a78', '#bcbca8', '#dcdcc8', '#f4f4e8'])
    const eye = pal.char('#101010')
    const b = f
    for (const x of [10, 14, 18, 22]) p.fill(path([[x, 24], [x - 1, 27], [x + 1, 30]], 0.8), shell, { flat: 'd' })
    p.fill(path([[10, 20 + b], [6, 17], [5, 14]], 1.4), shell)
    p.fill(path([[22, 20 + b], [26, 17], [27, 14]], 1.4), shell)
    p.fill(ellipse(5, 12 - b, 3.6, 3), shell).fill(ellipse(27, 12 - b, 3.6, 3), shell)
    p.dot(3, 11 - b, '.').dot(4, 11 - b, '.').dot(25, 11 - b, '.').dot(26, 11 - b, '.')
    p.fill(ellipse(16, 21 + b, 10, 6), shell)
    p.fill(seg(13, 16 + b, 12, 11 + b, 0.5), shell, { flat: 'o' }).fill(seg(19, 16 + b, 20, 11 + b, 0.5), shell, { flat: 'o' })
    p.dot(12, 10 + b, eye).dot(20, 10 + b, eye)
    for (const [x, y] of [[13, 18], [19, 19], [16, 22]] as [number, number][]) p.fill(ellipse(x, y + b, 1.6, 1.4), barnacle)
    p.outline().clean()
  },
  { idle: [0, 1], attack: [1], hurt: [0] },
)

export const hollowCrow = build(
  'hollow-crow',
  32,
  32,
  2,
  (p, pal, f) => {
    const black = pal.mat(['#050408', '#141220', '#221e32', '#36304a', '#504868'])
    const rib = pal.mat(['#1a1a18', '#8a8a80', '#c8c8bc', '#e4e4da', '#ffffff'])
    const beak = pal.mat(['#2a2008', '#8a7020', '#c0a030', '#e0c850', '#f8e890'])
    const eye = pal.char('#ff3030')
    const hollow = pal.char('#3a1a4a')
    const w = f === 1 ? 3 : 0
    p.fill(seg(17, 24, 15, 29, 0.6), beak, { flat: 'd' }).fill(seg(20, 24, 21, 29, 0.6), beak, { flat: 'd' })
    p.fill(poly([22, 16], [31, 6 + w], [29, 16 + w], [24, 22]), black)
    p.fill(poly([22, 20], [30, 24], [28, 26], [20, 24]), black)
    p.fill(ellipse(18, 18, 7, 8), black)
    p.fill(ellipse(18, 19, 4, 4.5), { o: hollow, d: hollow, m: hollow, l: hollow, h: hollow }, { flat: 'm' })
    for (const y of [16, 18, 20, 22]) p.fill(seg(15, y, 21, y, 0.45), rib, { flat: 'l' })
    p.fill(seg(18, 15, 18, 23, 0.45), rib, { flat: 'm' })
    p.fill(ellipse(11, 10, 4.5, 4.2), black)
    p.fill(poly([8, 9], [2, 11], [8, 12]), beak)
    p.dot(10, 9, eye)
    p.outline().clean()
  },
  { idle: [0, 1], attack: [1], hurt: [0] },
)

export const frostImp = build(
  'frost-imp',
  32,
  32,
  2,
  (p, pal, f) => {
    const ice = pal.mat(['#0a1c34', '#2a5a8a', '#4a8ac4', '#80c0ec', '#d0f0ff'])
    const horn = pal.mat(['#1a2a3a', '#8aa0b8', '#c0d4e8', '#e4f0fa', '#ffffff'])
    const eye = pal.char('#ffffff')
    const pupil = pal.char('#0a1020')
    const b = f
    p.fill(path([[22, 24], [27, 22], [29, 17]], 1, 0.6), ice)
    p.fill(seg(13, 25, 12, 30, 1.2), ice).fill(seg(19, 25, 20, 30, 1.2), ice)
    p.fill(ellipse(16, 21 + b, 6.5, 6.5), ice)
    p.fill(seg(11, 19 + b, 6, 23 + b, 1.2), ice).fill(seg(21, 19 + b, 25, 23 + b, 1.2), ice)
    p.fill(ellipse(15, 11 + b, 6, 5.5), ice)
    p.fill(poly([10, 8 + b], [8, 1 + b], [13, 7 + b]), horn).fill(poly([18, 7 + b], [22, 1 + b], [20, 9 + b]), horn)
    p.dots([[12, 11 + b], [16, 11 + b]], eye).dots([[12, 12 + b], [16, 12 + b]], pupil)
    p.dots([[13, 14 + b], [14, 14 + b], [15, 14 + b]], ice.o)
    p.outline().clean()
  },
  { idle: [0, 1], attack: [1], hurt: [0] },
)

export const cinderSlug = build(
  'cinder-slug',
  32,
  32,
  2,
  (p, pal, f) => {
    const body = pal.mat(['#140a1a', '#3a2440', '#5a3a60', '#7a5480', '#9a74a0'])
    const rock = pal.mat(['#0a0606', '#241414', '#3a2020', '#523030', '#6a4040'])
    const lava = pal.char(f === 0 ? '#ff7a1a' : '#ffb030')
    const glow = pal.char('#ffe080')
    const eye = pal.char('#ffd040')
    p.fill(poly([2, 28], [6, 22], [26, 22], [31, 28]), body)
    p.fill(seg(6, 22, 4, 15, 2.2), body)
    p.fill(seg(4, 14, 2, 9, 0.5), body, { flat: 'd' }).fill(seg(6, 14, 7, 9, 0.5), body, { flat: 'd' })
    p.dot(2, 8, eye).dot(7, 8, eye)
    p.fill(ellipse(18, 16, 8.5, 8), rock)
    const spiral: [number, number][] = [[18, 16], [19, 16], [19, 15], [18, 14], [17, 14], [16, 15], [16, 16], [16, 17], [17, 18], [18, 19], [19, 19], [20, 18], [21, 17], [21, 16], [21, 15], [21, 14], [20, 12], [18, 11], [16, 11], [14, 12], [13, 14], [13, 16], [13, 18], [14, 20]]
    p.dots(spiral, lava)
    p.dot(18, 16, glow)
    p.dots([[24, 12], [22, 22], [11, 20]], lava)
    p.outline().clean()
  },
  { idle: [0, 1], attack: [1], hurt: [0] },
)
