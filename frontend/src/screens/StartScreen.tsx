import { Scene } from '../components/Scene'

export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="screen start">
      <div className="scene-wrap">
        <Scene level="summit" enemy="Dragon" showPlayer={false}>
          <rect x="20" y="34" width="120" height="44" fill="#0f0f1b" opacity="0.85" />
          <text x="80" y="52" textAnchor="middle" className="scene-title">CRAM</text>
          <text x="80" y="70" textAnchor="middle" className="scene-title">CARTRIDGE</text>
        </Scene>
      </div>
      <p className="tagline">Turn your lecture slides into a climb. Every attack is a question.</p>
      <button type="button" className="btn big blink" onClick={onStart} autoFocus>
        PRESS START
      </button>
    </section>
  )
}
