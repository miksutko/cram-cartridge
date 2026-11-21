import type { ReactNode } from 'react'
import type { Level } from '../types'

// Placeholder art for the alpha: flat shapes only (cubes, triangles, rects).
// Every scene is 240x160 and scales up with crisp edges.

export interface SceneEffect {
  kind: 'enemy-hit' | 'player-hit'
  key: number
}

interface SceneProps {
  level: Level
  enemy?: string
  enemyHp?: number
  enemyMaxHp?: number
  playerHp?: number
  playerMaxHp?: number
  effect?: SceneEffect | null
  defeated?: boolean
  showPlayer?: boolean
  children?: ReactNode
}

const STALACTITES = [0, 22, 46, 70, 96, 122, 150, 176, 202, 226]
const TENTACLES = [14, 24, 34, 44, 54]
const TREES = [8, 52, 96, 222]
const FLAKES = [[20, 30], [64, 52], [110, 22], [150, 60], [200, 34], [232, 70], [40, 90], [90, 80]]
const CLOUDS = [[10, 40, 40], [70, 70, 52], [170, 30, 44], [196, 88, 36], [30, 110, 30]]

function Biome({ level }: { level: Level }) {
  switch (level) {
    case 1: // Underground
      return (
        <g>
          <rect width="240" height="160" fill="#1b1424" />
          {STALACTITES.map((x, i) => (
            <polygon key={x} points={`${x},0 ${x + 18},0 ${x + 9},${14 + (i % 3) * 8}`} fill="#3a2c48" />
          ))}
          <rect x="18" y="60" width="4" height="14" fill="#5a4030" />
          <rect x="16" y="52" width="8" height="8" fill="#ff9f1c" />
          <rect x="218" y="60" width="4" height="14" fill="#5a4030" />
          <rect x="216" y="52" width="8" height="8" fill="#ff9f1c" />
          <rect y="124" width="240" height="36" fill="#2a2033" />
          <rect y="124" width="240" height="4" fill="#4a3a5c" />
        </g>
      )
    case 2: // Stormy cave
      return (
        <g>
          <rect width="240" height="160" fill="#0b132b" />
          <polygon points="70,0 170,0 150,70 90,70" fill="#3a506b" />
          <polyline points="128,4 118,26 130,26 116,56" fill="none" stroke="#ffd166" strokeWidth="3" />
          <polygon points="0,0 70,0 90,70 0,110" fill="#1c2541" />
          <polygon points="240,0 170,0 150,70 240,110" fill="#1c2541" />
          <rect y="124" width="240" height="36" fill="#1b4965" />
          <rect x="10" y="130" width="24" height="3" fill="#5fa8d3" />
          <rect x="90" y="140" width="30" height="3" fill="#5fa8d3" />
          <rect x="180" y="134" width="26" height="3" fill="#5fa8d3" />
        </g>
      )
    case 3: // Dead forest
      return (
        <g>
          <rect width="240" height="160" fill="#3d4147" />
          <rect x="196" y="14" width="16" height="16" fill="#d9d9d9" />
          <rect y="88" width="240" height="10" fill="#555b62" />
          {TREES.map((x) => (
            <g key={x} fill="#2b2222">
              <rect x={x} y="40" width="8" height="84" />
              <polygon points={`${x},60 ${x - 14},44 ${x - 10},42 ${x + 2},54`} />
              <polygon points={`${x + 8},70 ${x + 22},52 ${x + 18},50 ${x + 6},62`} />
            </g>
          ))}
          <rect y="124" width="240" height="36" fill="#2e3a28" />
        </g>
      )
    case 4: // Snowy mountain
      return (
        <g>
          <rect width="240" height="160" fill="#9cc3dd" />
          <polygon points="0,124 60,40 130,124" fill="#c5d8e6" />
          <polygon points="90,124 170,30 240,124" fill="#e9f2f9" />
          {FLAKES.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" fill="#ffffff" />)}
          <rect y="124" width="240" height="36" fill="#f4f9fc" />
        </g>
      )
    case 5: // Volcano
      return (
        <g>
          <rect width="240" height="160" fill="#2d0a0a" />
          <polygon points="40,124 110,30 130,30 200,124" fill="#4b1d14" />
          <polygon points="110,30 130,30 124,40 116,40" fill="#ff5714" />
          <polygon points="118,40 124,40 140,124 126,124" fill="#ff7b00" />
          <rect y="124" width="240" height="36" fill="#1d0f0b" />
          <rect x="20" y="138" width="60" height="6" fill="#ff7b00" />
        </g>
      )
    default: // Cloudy summit
      return (
        <g>
          <rect width="240" height="160" fill="#6ec6ee" />
          {CLOUDS.map(([x, y, w]) => (
            <g key={`${x}-${y}`} fill="#ffffff">
              <rect x={x} y={y} width={w} height="8" />
              <rect x={x + 6} y={y - 6} width={w - 12} height="6" />
            </g>
          ))}
          <polygon points="0,124 120,70 240,124" fill="#8d99ae" />
          <polygon points="100,79 120,70 140,79 120,84" fill="#ffffff" />
          <rect y="124" width="240" height="36" fill="#5c677d" />
        </g>
      )
  }
}

function EnemyShape({ name }: { name: string }) {
  switch (name) {
    case 'Minotaur':
      return (
        <g>
          <polygon points="12,24 24,14 64,14 52,24" fill="#a8703a" />
          <polygon points="52,24 64,14 64,58 52,68" fill="#6b4220" />
          <rect x="12" y="24" width="40" height="44" fill="#8b5a2b" />
          <polygon points="14,22 4,2 24,16" fill="#f1e3c8" />
          <polygon points="50,18 62,0 60,18" fill="#f1e3c8" />
          <rect x="20" y="34" width="6" height="6" fill="#ff2e2e" />
          <rect x="38" y="34" width="6" height="6" fill="#ff2e2e" />
          <rect x="26" y="52" width="12" height="4" fill="#d4af37" />
          <rect x="16" y="68" width="10" height="16" fill="#5a3a1a" />
          <rect x="38" y="68" width="10" height="16" fill="#5a3a1a" />
        </g>
      )
    case 'Kraken':
      return (
        <g>
          <polygon points="16,40 20,16 32,6 44,6 56,16 60,40" fill="#7b2cbf" />
          <rect x="16" y="40" width="44" height="16" fill="#6a1fa8" />
          <rect x="24" y="26" width="8" height="8" fill="#ffd60a" />
          <rect x="44" y="26" width="8" height="8" fill="#ffd60a" />
          <rect x="27" y="29" width="3" height="3" fill="#000000" />
          <rect x="47" y="29" width="3" height="3" fill="#000000" />
          {TENTACLES.map((x, i) => (
            <g key={x} fill="#9d4edd">
              <rect x={x} y="56" width="6" height={20 + (i % 2) * 8} />
              <rect x={i % 2 ? x - 4 : x + 6} y={72 + (i % 2) * 8} width="4" height="4" />
            </g>
          ))}
        </g>
      )
    case 'Forest beast':
      return (
        <g>
          <polygon points="22,22 14,4 18,4 26,18" fill="#5c4033" />
          <polygon points="50,22 58,4 54,4 46,18" fill="#5c4033" />
          <polygon points="6,84 36,10 66,84" fill="#3a5a40" />
          <polygon points="18,84 36,42 54,84" fill="#2f4a33" />
          <rect x="26" y="46" width="6" height="6" fill="#e9ff70" />
          <rect x="40" y="46" width="6" height="6" fill="#e9ff70" />
          <polygon points="26,62 30,70 34,62" fill="#ffffff" />
          <polygon points="38,62 42,70 46,62" fill="#ffffff" />
        </g>
      )
    case 'Yeti':
      return (
        <g>
          <polygon points="10,20 22,10 70,10 58,20" fill="#ffffff" />
          <polygon points="58,20 70,10 70,62 58,72" fill="#cbd5e1" />
          <rect x="10" y="20" width="48" height="52" fill="#f1f5f9" />
          <rect x="20" y="30" width="28" height="22" fill="#7aa6c2" />
          <rect x="24" y="36" width="5" height="5" fill="#000000" />
          <rect x="39" y="36" width="5" height="5" fill="#000000" />
          <rect x="28" y="46" width="12" height="3" fill="#1e293b" />
          <rect x="16" y="72" width="12" height="12" fill="#e2e8f0" />
          <rect x="40" y="72" width="12" height="12" fill="#e2e8f0" />
        </g>
      )
    case 'Phoenix':
      return (
        <g>
          <polygon points="26,40 0,12 10,52" fill="#ffb703" />
          <polygon points="46,40 72,12 62,52" fill="#ffb703" />
          <polygon points="36,20 46,44 36,70 26,44" fill="#ff7b00" />
          <polygon points="30,22 36,6 42,22" fill="#ffd166" />
          <rect x="35" y="13" width="3" height="3" fill="#000000" />
          <polygon points="30,70 36,84 42,70" fill="#e85d04" />
        </g>
      )
    default: // Dragon
      return (
        <g transform="translate(-10,-10)">
          <polygon points="30,34 0,0 12,48" fill="#9d0208" />
          <polygon points="62,34 92,0 80,48" fill="#9d0208" />
          <polygon points="26,42 66,42 74,94 18,94" fill="#d00000" />
          <polygon points="36,52 56,52 60,94 32,94" fill="#ffba08" />
          <rect x="38" y="20" width="18" height="24" fill="#d00000" />
          <rect x="32" y="8" width="30" height="16" fill="#d00000" />
          <rect x="60" y="14" width="12" height="9" fill="#d00000" />
          <polygon points="34,8 37,0 41,8" fill="#f1e3c8" />
          <polygon points="50,8 54,0 57,8" fill="#f1e3c8" />
          <rect x="44" y="12" width="5" height="5" fill="#ffea00" />
        </g>
      )
  }
}

function Player() {
  return (
    <g>
      <rect x="26" y="0" width="2" height="22" fill="#c0c0c0" />
      <rect x="23" y="20" width="8" height="2" fill="#8d6e63" />
      <polygon points="4,12 9,7 27,7 22,12" fill="#64a6ff" />
      <polygon points="22,12 27,7 27,27 22,32" fill="#2563c9" />
      <rect x="4" y="12" width="18" height="20" fill="#3a86ff" />
      <rect x="8" y="17" width="3" height="3" fill="#ffffff" />
      <rect x="15" y="17" width="3" height="3" fill="#ffffff" />
      <rect x="6" y="32" width="4" height="8" fill="#1d3557" />
      <rect x="15" y="32" width="4" height="8" fill="#1d3557" />
    </g>
  )
}

export function Scene({
  level,
  enemy,
  enemyHp = 0,
  enemyMaxHp = 0,
  playerHp = 0,
  playerMaxHp = 0,
  effect,
  defeated,
  showPlayer = true,
  children,
}: SceneProps) {
  const enemyHit = effect?.kind === 'enemy-hit'
  const playerHit = effect?.kind === 'player-hit'
  return (
    <svg className="scene" viewBox="0 0 240 160" shapeRendering="crispEdges" role="img" aria-label={enemy ?? 'scene'}>
      <Biome level={level} />
      {showPlayer && (
        <g transform="translate(36,84)">
          <g key={playerHit ? effect?.key : 'still'} className={playerHit ? 'shake' : undefined}>
            <Player />
          </g>
        </g>
      )}
      {enemy && (
        <g transform="translate(150,40)">
          <g
            key={enemyHit ? effect?.key : 'still'}
            className={defeated ? 'defeated' : enemyHit ? 'shake' : 'idle'}
          >
            <EnemyShape name={enemy} />
          </g>
        </g>
      )}
      {playerHit && <rect key={`flash-${effect?.key}`} className="flash" width="240" height="160" fill="#ff0000" />}
      {playerMaxHp > 0 && (
        <g>
          {Array.from({ length: playerMaxHp }, (_, i) => (
            <rect key={i} x={6 + i * 11} y="6" width="8" height="7" fill={i < playerHp ? '#ff3b3b' : '#3a3a3a'} />
          ))}
        </g>
      )}
      {enemy && enemyMaxHp > 0 && (
        <g>
          <text x="234" y="12" textAnchor="end" className="scene-text">{enemy.toUpperCase()}</text>
          <rect x="142" y="16" width="92" height="6" fill="#222222" />
          <rect x="142" y="16" width={Math.round((92 * Math.max(enemyHp, 0)) / enemyMaxHp)} height="6" fill="#ff5d5d" />
        </g>
      )}
      {children}
    </svg>
  )
}
