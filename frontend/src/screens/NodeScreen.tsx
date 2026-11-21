import { useEffect, useState } from 'react'
import type { RunCtx } from '../App'
import { api, errorText, Unsupported } from '../api/client'
import type { Item, NodeResult, RunOver, Treasure } from '../api/types'
import { biomeOf } from '../art/backgrounds'
import { Sprite } from '../art/Sprite'
import { Background } from '../components/Background'
import { Loading, MessageBox, PixelBox } from '../components/ui'
import { useMenu } from '../components/keys'
import { itemInfo, LINES } from '../game/content'
import { sfx } from '../game/sfx'
import { Battle } from './Battle'

interface Props {
  userId: string
  run: RunCtx
  nodeId: string
  setRun: (fn: (r: RunCtx | null) => RunCtx | null) => void
  onDone: () => void
  onRunOver: (r: RunOver) => void
}

/** Enters a node (POST /api/node) and shows a battle or a treasure trove. */
export function NodeScreen({ userId, run, nodeId, setRun, onDone, onRunOver }: Props) {
  const [node, setNode] = useState<NodeResult | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([api.enterNode(run.runId, nodeId), api.map(run.runId).catch(() => null)])
      .then(([n, m]) => {
        if (!alive) return
        setNode(n)
        if (m) {
          setItems(m.items ?? [])
          setScore(m.score ?? null)
        }
      })
      .catch((err) => alive && setError(errorText(err)))
    return () => {
      alive = false
    }
  }, [run.runId, nodeId])

  if (error) return <MessageBox title={LINES.dusty} text={error} onClose={onDone} action="BACK TO MAP" />
  if (!node) return <Loading text={LINES.approach} />
  if (node.kind === 'treasure') return <TreasureScreen run={run} node={node} onDone={onDone} />
  return <Battle userId={userId} run={run} fight={node} items={items} score={score} setRun={setRun} onDone={onDone} onRunOver={onRunOver} />
}

function TreasureScreen({ run, node, onDone }: { run: RunCtx; node: Treasure; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = async (i: number) => {
    if (!open) {
      sfx('treasure')
      setOpen(true)
      return
    }
    const choice = node.choices[i]
    if (!choice || busy || got) return
    setBusy(true)
    try {
      await api.treasure(run.runId, node.node_id, choice.choice_id)
      sfx('confirm')
      setGot(itemInfo(choice.item_id, choice.name).name)
    } catch (err) {
      setError(err instanceof Unsupported ? 'The chest is sealed: treasure is not on this server yet.' : errorText(err))
    } finally {
      setBusy(false)
    }
  }
  const [sel, setSel] = useMenu(node.choices.length, (i) => void (got ? onDone() : pick(i)))

  return (
    <div className="scr treasure">
      <Background biome={biomeOf(node.level)} still />
      <div className="scr-title">TREASURE TROVE</div>
      <button type="button" className={`chest ${open ? 'open' : ''}`} onClick={() => void pick(sel)}>
        <Sprite id="chest" anim={open ? 'open' : 'closed'} />
      </button>
      {!open && <div className="hint-line bottom blink">ENTER: OPEN THE CHEST</div>}
      {open && !got && (
        <div className="treasure-cards">
          {node.choices.map((c, i) => {
            const info = itemInfo(c.item_id, c.name)
            return (
              <button type="button" key={c.choice_id} className={`item-card ${sel === i ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => void pick(i)} disabled={busy}>
                <Sprite id={info.icon} />
                <span className="item-name">{info.name}</span>
                <span className="item-desc">{c.desc ?? info.desc}</span>
              </button>
            )
          })}
        </div>
      )}
      {got && (
        <PixelBox className="treasure-got">
          <div>YOU GOT {got.toUpperCase()}!</div>
          <button type="button" className="pbtn" onClick={onDone} autoFocus>
            ONWARD ▶
          </button>
        </PixelBox>
      )}
      {error && <MessageBox title={LINES.dusty} text={error} onClose={onDone} action="BACK TO MAP" />}
    </div>
  )
}
