import { Background } from '../components/Background'
import { PixelBox } from '../components/ui'
import { useKeys, useMenu } from '../components/keys'
import { GAME } from '../game/content'
import { settings, update, type ScaleSetting, type TextSpeed } from '../game/settings'
import { sfx } from '../game/sfx'
import { useStore } from '../game/store'

const SPEEDS: TextSpeed[] = ['slow', 'normal', 'instant']
const SCALES: ScaleSetting[] = ['auto', 2, 3, 4]

export function SettingsScreen({ onBack, onChangeName }: { onBack: () => void; onChangeName: () => void }) {
  const s = useStore(settings)
  const cycle = <T,>(list: T[], v: T, d: number) => list[(list.indexOf(v) + d + list.length) % list.length]
  const rows = [
    { label: 'NAME', value: s.name ?? GAME.defaultName, act: () => onChangeName() },
    { label: 'MUSIC', value: `${'■'.repeat(Math.round(s.music * 5))}${'□'.repeat(5 - Math.round(s.music * 5))}`, adj: (d: number) => update({ music: Math.max(0, Math.min(1, Math.round((s.music + d * 0.2) * 5) / 5)) }) },
    { label: 'SOUND FX', value: s.sfx ? 'ON' : 'OFF', adj: () => update({ sfx: !s.sfx }) },
    { label: 'TEXT SPEED', value: s.textSpeed.toUpperCase(), adj: (d: number) => update({ textSpeed: cycle(SPEEDS, s.textSpeed, d) }) },
    { label: 'SCREEN SCALE', value: s.scale === 'auto' ? 'AUTO' : `${s.scale}×`, adj: (d: number) => update({ scale: cycle(SCALES, s.scale, d) }) },
    { label: 'REDUCED MOTION', value: s.reducedMotion ? 'ON' : 'OFF', adj: () => update({ reducedMotion: !s.reducedMotion }) },
    { label: 'BACK', value: '', act: onBack },
  ]
  const run = (i: number, d = 1) => {
    const r = rows[i]
    sfx('blip')
    if (r.act) r.act()
    else r.adj?.(d)
  }
  const [sel, setSel] = useMenu(rows.length, (i) => run(i), true)
  useKeys({
    ArrowLeft: () => rows[sel].adj && run(sel, -1),
    ArrowRight: () => rows[sel].adj && run(sel, 1),
    Escape: onBack,
  })
  return (
    <div className="scr settings">
      <Background biome="summit" still />
      <div className="scr-title">SETTINGS</div>
      <PixelBox className="settings-box">
        {rows.map((r, i) => (
          <button type="button" key={r.label} className={`set-row ${sel === i ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => run(i)}>
            <span>{sel === i ? '▶ ' : '  '}{r.label}</span>
            <b>{r.adj ? `◀ ${r.value} ▶` : r.value}</b>
          </button>
        ))}
      </PixelBox>
      <div className="hint-line bottom">▲▼ PICK · ◀▶ CHANGE · ESC BACK</div>
    </div>
  )
}
