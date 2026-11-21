import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { RunCtx } from '../App'
import { api, errorText, Unsupported } from '../api/client'
import type { AnswerResult, Fight, Item, RunOver } from '../api/types'
import { biomeOf, GROUND, SCREEN_H } from '../art/backgrounds'
import { Sprite } from '../art/Sprite'
import { Background } from '../components/Background'
import { QuoteCard } from '../components/QuoteCard'
import { Hearts, HpBar, MessageBox, PixelBox, Typewriter } from '../components/ui'
import { useKeys } from '../components/keys'
import { BIOMES, DRAGON, ENEMY_SPRITES, enemyName, itemInfo, LINES } from '../game/content'
import { playMusic, type MusicSlot } from '../game/music'
import { playerName, prefersReducedMotion } from '../game/settings'
import { sfx } from '../game/sfx'

interface Props {
  userId: string
  run: RunCtx
  fight: Fight
  items: Item[]
  score: number | null
  setRun: (fn: (r: RunCtx | null) => RunCtx | null) => void
  onDone: () => void
  onRunOver: (r: RunOver) => void
}

type Phase = 'intro' | 'ask' | 'pending' | 'result' | 'quote' | 'cleared' | 'lost'
type Anim = 'idle' | 'attack' | 'hurt'

const KEYS = ['1', '2', '3', '4']
const ITEM_KEYS = ['q', 'e', 'r', 't']

function spriteFor(fight: Fight): string {
  const byName = ENEMY_SPRITES[fight.enemy.name.toLowerCase()]
  if (byName) return byName
  const b = BIOMES[biomeOf(fight.level)]
  return fight.kind === 'miniboss' || fight.kind === 'boss' ? b.bossSprite : b.minionSprite
}

export function Battle({ userId, run, fight, items: startItems, score: startScore, setRun, onDone, onRunOver }: Props) {
  const biome = BIOMES[biomeOf(fight.level)]
  const isBoss = fight.kind === 'boss'
  const enemySprite = spriteFor(fight)
  const name = playerName()
  const newLevel = run.lastLevel !== fight.level
  const [phase, setPhase] = useState<Phase>(isBoss || newLevel ? 'intro' : 'ask')
  const [qId, setQId] = useState<string | null>(fight.current_q_id)
  const [hp, setHp] = useState(fight.player_hp)
  const [enemyHp, setEnemyHp] = useState(fight.enemy.hp)
  const [score, setScore] = useState<number | null>(startScore)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pAnim, setPAnim] = useState<Anim>('idle')
  const [eAnim, setEAnim] = useState<Anim>('idle')
  const [fx, setFx] = useState<{ shake: boolean; pFlash: boolean; eFlash: boolean; dmg: string | null; dmgSide: 'p' | 'e' }>({ shake: false, pFlash: false, eFlash: false, dmg: null, dmgSide: 'e' })
  const [items, setItems] = useState<Item[]>(startItems)
  const [removed, setRemoved] = useState<number[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const [shield, setShield] = useState(false)
  const [itemsOff, setItemsOff] = useState(false)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => performance.now())
  const sending = useRef(false)
  // Lift the scene when the question box is taller than the strip below the painted ground.
  const [lift, setLift] = useState(0)
  const boxObserver = useRef<ResizeObserver | null>(null)
  const qboxRef = useCallback((el: HTMLDivElement | null) => {
    boxObserver.current?.disconnect()
    boxObserver.current = null
    if (!el) {
      setLift(0)
      return
    }
    const measure = () => setLift(Math.max(0, Math.round(el.offsetHeight + 6 - (SCREEN_H - GROUND))))
    boxObserver.current = new ResizeObserver(measure)
    boxObserver.current.observe(el)
    measure()
  }, [])
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const question = fight.questions.find((q) => q.q_id === qId) ?? null
  const typedQ = question?.type === 'typed'

  useEffect(() => {
    const slot: MusicSlot = isBoss ? 'boss' : biome.level === 'summit' ? 'summit' : (`level${biome.level}` as MusicSlot)
    playMusic(slot)
  }, [isBoss, biome.level])

  // Intro: level card and/or the dragon's entrance.
  useEffect(() => {
    if (phase !== 'intro') return
    setRun((r) => (r ? { ...r, lastLevel: fight.level } : r))
    if (isBoss) {
      sfx('thunder')
      later(() => sfx('roar'), 500)
    } else sfx('levelUp')
    const id = window.setTimeout(() => setPhase((p) => (p === 'intro' ? 'ask' : p)), isBoss ? 3400 : 1500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Blitz: count down to the server's limit. The server decides when time is up.
  const limit = fight.kind === 'blitz' || question?.time_limit_ms ? (question?.time_limit_ms ?? 10_000) : null
  useEffect(() => {
    if (phase !== 'ask' || !limit) return
    const left = result?.time_left_ms ?? fight.time_left_ms ?? limit
    const id = window.setTimeout(() => setDeadline(performance.now() + left), 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qId, limit])
  useEffect(() => {
    if (!deadline || phase !== 'ask') return
    const id = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(id)
  }, [deadline, phase])
  const msLeft = deadline ? Math.max(0, deadline - now) : null

  function land(res: AnswerResult) {
    setResult(res)
    if (res.score !== undefined) setScore(res.score)
    const reduced = prefersReducedMotion()
    if (res.correct) {
      sfx('hit')
      setPAnim('attack')
      later(() => {
        setEnemyHp(res.enemy_hp)
        setFx((f) => ({ ...f, eFlash: true, dmg: '-1', dmgSide: 'e' }))
        setEAnim('hurt')
      }, reduced ? 0 : 180)
      later(() => {
        setPAnim('idle')
        setEAnim('idle')
        setFx((f) => ({ ...f, eFlash: false }))
      }, reduced ? 200 : 520)
    } else {
      sfx('miss')
      setEAnim('attack')
      later(() => {
        setHp(res.player_hp)
        setFx((f) => ({ ...f, shake: !reduced, pFlash: true, dmg: res.blocked ? LINES.blocked : '-1', dmgSide: 'p' }))
        setPAnim('hurt')
        if (res.blocked) setShield(false)
      }, reduced ? 0 : 180)
      later(() => {
        setEAnim('idle')
        setPAnim(res.player_hp <= 0 ? 'hurt' : 'idle')
        setFx((f) => ({ ...f, shake: false, pFlash: false }))
      }, reduced ? 200 : 560)
    }
    later(() => setFx((f) => ({ ...f, dmg: null })), 900)

    if (res.node_cleared && (fight.kind === 'miniboss' || fight.kind === 'boss')) {
      setRun((r) => (r ? { ...r, bosses: [...r.bosses, enemyName(fight.enemy.name)] } : r))
    }
    if (!res.correct && res.quote) setRun((r) => (r ? { ...r, quotesSeen: r.quotesSeen + 1 } : r))

    later(() => {
      if (!res.correct) setPhase('quote')
      else if (res.node_cleared) {
        sfx('levelUp')
        setPhase('cleared')
      } else setPhase('result')
    }, 620)
  }

  async function send(choice: number | null, text: string | null, retry = 0) {
    if (!question || sending.current) return
    sending.current = true
    setDeadline(null)
    setPhase('pending')
    try {
      const res = await api.answer({ user_id: userId, run_id: run.runId, q_id: question.q_id, choice, text })
      sending.current = false
      land(res)
    } catch (err) {
      sending.current = false
      if (choice === null && text === null) {
        // Our clock ran out before the server's: ask again shortly, then resync quietly.
        if (retry < 3) later(() => void send(null, null, retry + 1), 500)
        else setPhase('ask')
        return
      }
      setError(errorText(err))
      setPhase('ask')
    }
  }

  useEffect(() => {
    if (msLeft === 0 && phase === 'ask') void send(null, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, phase])

  function next() {
    if (!result) return
    if (result.run_status === 'lost' || (result.run_over && !result.run_over.won)) {
      setPhase('lost')
      later(() => onRunOver(result.run_over!), 1400)
      return
    }
    if (result.node_cleared) {
      if (phase !== 'cleared') {
        sfx('levelUp')
        setPhase('cleared')
        return
      }
      if (result.run_over) onRunOver(result.run_over)
      else onDone()
      return
    }
    setQId(result.next_q_id)
    setResult(null)
    setPicked(null)
    setTyped('')
    setRemoved([])
    setHint(null)
    setPhase('ask')
  }

  // A correct answer moves on by itself after a moment.
  useEffect(() => {
    if (phase !== 'result' || !result?.correct || result.node_cleared) return
    const id = window.setTimeout(next, 1100)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result])

  function choose(i: number) {
    if (phase !== 'ask' || !question || typedQ || removed.includes(i) || i >= question.choices.length) return
    setPicked(i)
    void send(i, null)
  }

  function submitTyped(e?: FormEvent) {
    e?.preventDefault()
    if (phase !== 'ask' || !typed.trim()) return
    void send(null, typed.trim())
  }

  async function activateItem(idx: number) {
    const it = items[idx]
    if (!it || phase !== 'ask' || itemsOff) return
    try {
      const res = await api.useItem(run.runId, it.item_id, qId)
      sfx('treasure')
      setItems(res.items)
      setHp(res.player_hp)
      if (res.remove) setRemoved(res.remove)
      if (res.hint) setHint(res.hint)
      if (res.shield) setShield(true)
    } catch (err) {
      if (err instanceof Unsupported) {
        setItemsOff(true)
        setError('Items cannot be used on this server yet.')
      } else setError(errorText(err))
    }
  }

  useKeys({
    ...Object.fromEntries(KEYS.map((k, i) => [k, () => choose(i)])),
    ...Object.fromEntries(ITEM_KEYS.map((k, i) => [k, () => !typedQ && void activateItem(i)])),
    Enter: () => {
      if (phase === 'intro') setPhase('ask')
      else if (phase === 'ask' && typedQ) submitTyped()
      else if (phase === 'result' || phase === 'cleared') next()
    },
    ' ': () => {
      if (phase === 'intro') setPhase('ask')
      else if (phase === 'result' || phase === 'cleared') next()
    },
  })

  const firstMemory = isBoss && question?.slot === 'memory'
  const dead = phase === 'cleared' || (result?.node_cleared ?? false)

  return (
    <div
      className={`scr battle ${fx.shake ? 'shake' : ''} ${phase === 'lost' ? 'grey-out' : ''}`}
      style={{ ['--lift' as string]: `${lift}px` }}
    >
      <Background biome={biome.id} />

      {/* HUD */}
      <div className="hud">
        <div className="hud-left">
          <span className="hud-name">{name}</span>
          <Hearts hp={hp} max={fight.max_hp} />
          {shield && <Sprite id="item-aegis_ward" className="hud-shield" />}
        </div>
        <div className="hud-mid">{score !== null ? `SCORE ${score}` : fight.kind === 'blitz' ? 'BLITZ!' : ''}</div>
        <div className="hud-right">
          <span className="hud-name">{enemyName(fight.enemy.name).toUpperCase()}</span>
          <HpBar hp={enemyHp} max={fight.enemy.max_hp} colors={biome.colors} />
        </div>
      </div>
      {limit && phase !== 'intro' && (
        <div className={`blitz-bar ${msLeft !== null && msLeft < 3000 ? 'urgent' : ''}`}>
          <span style={{ width: `${((msLeft ?? limit) / limit) * 100}%` }} />
          <b>{msLeft !== null ? Math.ceil(msLeft / 1000) : ''}</b>
        </div>
      )}

      {/* combatants */}
      <div className={`fighter player ${pAnim === 'attack' ? 'lunge-right' : ''} ${fx.pFlash ? 'flash' : ''} ${phase === 'lost' ? 'die' : ''}`}>
        <Sprite id="player" anim={pAnim} />
      </div>
      <div className={`fighter enemy ${isBoss ? 'dragon' : fight.kind === 'miniboss' ? 'boss' : 'minion'} ${eAnim === 'attack' ? 'lunge-left' : ''} ${fx.eFlash ? 'flash' : ''} ${dead ? 'die' : ''}`}>
        <Sprite id={enemySprite} anim={eAnim} speed={isBoss ? 1 : 2} />
      </div>
      {fx.dmg && <div className={`dmg dmg-${fx.dmgSide}`}>{fx.dmg}</div>}
      {firstMemory && phase === 'ask' && <div className="callout">{DRAGON.memoryCallout}</div>}

      {/* question box */}
      {question && phase !== 'intro' && phase !== 'cleared' && phase !== 'lost' && (
        <div className="qbox" ref={qboxRef}>
          <div className="q-meta">
            <span>{fight.kind === 'blitz' ? 'BLITZ' : isBoss ? 'SUMMIT' : `LV${biome.level}`} · {question.subtopic}</span>
            {question.slot === 'memory' && <span className="tag tag-memory">YOU MISSED THIS</span>}
            {question.slot === 'other_lecture' && (
              <span className="tag tag-other">
                {DRAGON.otherLecture.toUpperCase()}: {question.deck_name}
                {question.similarity != null && ` · MATCH ${question.similarity.toFixed(2)}`}
              </span>
            )}
            {items.length > 0 && !itemsOff && (
              <span className="q-items">
                {items.map((it, i) => (
                  <button type="button" key={it.item_id} className="item-chip" onClick={() => void activateItem(i)} title={`${itemInfo(it.item_id, it.name).name}: ${itemInfo(it.item_id).desc}`}>
                    <Sprite id={itemInfo(it.item_id, it.name).icon} />
                    <span className="key">{ITEM_KEYS[i]?.toUpperCase()}</span>
                  </button>
                ))}
              </span>
            )}
          </div>
          <div className="q-prompt">{question.prompt}</div>
          {hint && <div className="q-hint">✦ {hint}</div>}
          {typedQ ? (
            <form className="q-typed" onSubmit={submitTyped}>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={phase !== 'ask'}
                autoFocus
                maxLength={120}
                placeholder="Type your answer..."
                aria-label="Your answer"
              />
              <button type="submit" className="pbtn" disabled={phase !== 'ask' || !typed.trim()}>
                CAST ▶
              </button>
            </form>
          ) : (
            <div className={`choices ${question.choices.every((c) => c.length <= 24) ? 'grid' : ''}`}>
              {question.choices.map((c, i) => {
                let state = ''
                if (result) state = i === result.answer.index ? 'right' : i === picked ? 'wrong' : 'dim'
                else if (removed.includes(i)) state = 'gone'
                else if (i === picked) state = 'sel'
                return (
                  <button type="button" key={i} className={`choice ${state}`} onClick={() => choose(i)} disabled={phase !== 'ask' || removed.includes(i)}>
                    <span className="key">{i + 1}</span>
                    {c}
                  </button>
                )
              })}
            </div>
          )}
          {phase === 'pending' && <div className="q-pending blink">⚔</div>}
          {phase === 'result' && result && (
            <div className={`q-result ${result.correct ? 'ok' : 'bad'}`}>
              {result.timed_out ? LINES.timeout : result.correct ? LINES.hit : LINES.miss}{' '}
              <span className="dim">
                {enemyName(fight.enemy.name)}: “{result.taunt}”
              </span>
              {typedQ && !result.correct && <span> · {result.answer.text}</span>}
            </div>
          )}
        </div>
      )}

      {phase === 'intro' && !isBoss && (
        <div className="level-card">
          <div className="level-card-inner" style={{ borderColor: biome.colors[2] }}>
            {biome.card}
          </div>
        </div>
      )}
      {phase === 'intro' && isBoss && (
        <div className="dragon-intro" onClick={() => setPhase('ask')}>
          <div className="lightning-flash" />
          <div className="dragon-card">{DRAGON.title}</div>
          <PixelBox className="dragon-line">
            <Typewriter text={DRAGON.entrance(name)} />
          </PixelBox>
        </div>
      )}
      {phase === 'cleared' && (
        <div className="cleared-banner" onClick={next}>
          <div className="cleared-text">{isBoss ? LINES.victory : LINES.slain}</div>
          <div className="blink small">ENTER ▶</div>
        </div>
      )}
      {phase === 'lost' && <div className="cleared-banner"><div className="cleared-text bad">{LINES.defeat}</div></div>}
      {phase === 'quote' && result && (
        <QuoteCard
          enemy={enemyName(fight.enemy.name)}
          enemySprite={enemySprite}
          taunt={result.timed_out ? `${LINES.timeout} ${result.taunt}` : result.taunt}
          quote={result.quote}
          explanation={result.explanation}
          answer={result.answer.text}
          onClose={next}
        />
      )}
      {error && <MessageBox title={LINES.dusty} text={error} onClose={() => setError(null)} />}
    </div>
  )
}
