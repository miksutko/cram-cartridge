import { useEffect, useRef } from 'react'
import { backgroundCanvas, drawAtmosphere, H, makeAtmos, W, type BiomeId } from '../art/backgrounds'
import { frameUrl } from '../art/pixel'
import { allSprites, overrides } from '../art/registry'
import { Sprite } from '../art/Sprite'
import { BIOMES } from '../game/content'

/** Dev-only #/gallery: every sprite (all frames + animated), every background, the palettes. */
export function Gallery({ onBack }: { onBack: () => void }) {
  return (
    <div className="gallery">
      <header>
        <h1>ART GALLERY</h1>
        <button type="button" onClick={onBack}>
          ◀ BACK TO THE GAME
        </button>
        <p>All art is drawn in code (src/art). Drop src/assets/sprites/&lt;id&gt;.png to replace any sprite.</p>
      </header>
      <h2>BACKGROUNDS (240×160, 2×, animated)</h2>
      <div className="g-grid">
        {(Object.keys(BIOMES) as BiomeId[]).map((b) => (
          <figure key={b} className="g-card">
            <BgPreview id={b} />
            <figcaption>
              <b>{b}</b> {BIOMES[b].name} · boss {BIOMES[b].boss}
              <span className="g-pal">
                {BIOMES[b].colors.map((c) => (
                  <i key={c} style={{ background: c }} title={c} />
                ))}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <h2>SPRITES (4×)</h2>
      <div className="g-grid">
        {allSprites.map((s) => (
          <figure key={s.id} className="g-card">
            <div className="g-row">
              <div className="checker" title="animated">
                <Sprite id={s.id} scale={4} />
              </div>
              {s.frames.map((_, f) => (
                <div className="checker small" key={f}>
                  <img src={frameUrl(s, f)} width={s.w * 2} height={s.h * 2} alt="" className="sprite" />
                </div>
              ))}
            </div>
            <figcaption>
              <b>{s.id}</b> {s.w}×{s.h} · {s.frames.length} frames · {Object.keys(s.palette).length} colours
              {s.anims ? ` · ${Object.keys(s.anims).join(', ')}` : ''}
              {overrides[s.id] ? ' · PNG OVERRIDE' : ''}
              <span className="g-pal">
                {Object.values(s.palette).map((c) => (
                  <i key={c} style={{ background: c }} title={c} />
                ))}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function BgPreview({ id }: { id: BiomeId }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const a = makeAtmos(id)
    let t = 0
    const tick = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(backgroundCanvas(id), 0, 0)
      const off = document.createElement('canvas')
      off.width = W
      off.height = H
      const octx = off.getContext('2d')!
      drawAtmosphere(octx, id, a, t++)
      ctx.drawImage(off, 0, 0)
    }
    tick()
    const iv = window.setInterval(tick, 80)
    return () => window.clearInterval(iv)
  }, [id])
  return <canvas ref={ref} width={W} height={H} className="g-bg" />
}
