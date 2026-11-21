import { Background } from '../components/Background'
import { NameEntry } from '../components/NameEntry'
import { settings, update } from '../game/settings'

export function NameScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  return (
    <div className="scr">
      <Background biome="summit" still />
      <NameEntry
        initial={settings.get().name ?? ''}
        onDone={(name) => {
          update({ name })
          onDone()
        }}
        onBack={onBack}
      />
    </div>
  )
}
