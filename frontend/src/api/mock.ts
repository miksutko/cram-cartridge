// In-memory fake backend that follows the API contract exactly, plus the PROPOSED
// additions in frontend/HANDOFF.md. Like the real server, it never sends the correct
// answer before the player answers, and it owns HP, damage, paths, timing and score.
// Used only with VITE_MOCK=1, ?mock=1, or when /api/health fails at startup.

import { ApiError, Unsupported, type Backend } from './client'
import type {
  AnswerRequest,
  AnswerResult,
  DeckSummary,
  Fight,
  FightQuestion,
  Item,
  Level,
  MapNode,
  NodeResult,
  Report,
  RunMap,
  RunOver,
  ScoreRow,
  TraceStep,
} from './types'

interface Q {
  id: string
  sub: number
  page: number
  prompt: string
  reword?: string
  choices?: string[] // correct first; shuffled per fight
  accept?: string[] // typed answers
  explanation: string
  quote: string
}

interface Deck {
  deck_id: string
  name: string
  main_topic: string
  subtopics: string[]
  slides: number
  questions: Q[]
}

const ALGORITHMS: Deck = {
  deck_id: 'mock-algorithms',
  name: 'Sample: Algorithms 101',
  main_topic: 'Algorithms',
  slides: 12,
  subtopics: ['Big-O notation', 'Binary search', 'Recursion', 'Sorting'],
  questions: [
    { id: 'a1', sub: 0, page: 2, prompt: 'What does Big-O describe?', reword: 'Big-O notation tells you what about an algorithm?',
      choices: ['How cost grows as input grows', 'The exact running time in seconds', 'How much code it takes', 'The best case only'],
      explanation: 'Big-O is about growth rate, not exact time.', quote: 'Big-O: the cost of an algorithm as input grows.' },
    { id: 'a2', sub: 0, page: 3, prompt: 'Which grows fastest for large n?',
      choices: ['O(2^n)', 'O(n^2)', 'O(n log n)', 'O(n)'],
      explanation: 'Exponential growth beats every polynomial.', quote: 'Exponential time, O(2^n), grows faster than any polynomial.' },
    { id: 'a3', sub: 0, page: 3, prompt: 'Looping once over n items is...',
      choices: ['O(n)', 'O(1)', 'O(log n)', 'O(n^2)'],
      explanation: 'One step per item means linear time.', quote: 'A single loop over n items takes O(n) time.' },
    { id: 'a4', sub: 0, page: 4, prompt: 'Type the Big-O of two nested loops over n items.',
      accept: ['o(n^2)', 'o(n2)', 'n^2', 'o(n²)', 'n2', 'n²', 'quadratic'],
      explanation: 'n steps inside n steps gives n times n.', quote: 'Two nested loops over n items take O(n^2) time.' },
    { id: 'b1', sub: 1, page: 5, prompt: 'What is the time complexity of binary search?', reword: 'How many steps does binary search need, in Big-O?',
      choices: ['O(log n)', 'O(n)', 'O(1)', 'O(n log n)'],
      explanation: 'Each step halves what is left to search.', quote: 'Binary search halves the search space each step, so it runs in O(log n).' },
    { id: 'b2', sub: 1, page: 5, prompt: 'What must be true before binary search works?',
      choices: ['The list is sorted', 'The list has no duplicates', 'The list is short', 'The list is a linked list'],
      explanation: 'Halving only works if order tells you which half to keep.', quote: 'Binary search only works on a sorted list.' },
    { id: 'b3', sub: 1, page: 6, prompt: 'Binary search compares the target with...',
      choices: ['The middle element', 'The first element', 'The last element', 'A random element'],
      explanation: 'The middle splits the list into two halves.', quote: 'Compare the target with the middle element, then keep one half.' },
    { id: 'b4', sub: 1, page: 6, prompt: 'Type the name of the element binary search checks first.',
      accept: ['middle', 'the middle', 'middle element', 'the middle element', 'mid', 'median'],
      explanation: 'It always starts in the middle.', quote: 'Compare the target with the middle element, then keep one half.' },
    { id: 'c1', sub: 2, page: 7, prompt: 'What stops a recursive function from running forever?', reword: 'Which part of a recursive function ends the recursion?',
      choices: ['A base case', 'A global variable', 'A while loop', 'A return type'],
      explanation: 'The base case returns without recursing again.', quote: 'Every recursive function needs a base case that returns without calling itself.' },
    { id: 'c2', sub: 2, page: 8, prompt: 'What happens if recursion never reaches a base case?',
      choices: ['Stack overflow', 'It returns 0', 'It becomes a loop', 'The compiler fixes it'],
      explanation: 'Each call adds a stack frame until memory runs out.', quote: 'Without a base case, calls pile up on the call stack until it overflows.' },
    { id: 'c3', sub: 2, page: 8, prompt: 'Each recursive call should move the input...',
      choices: ['Closer to the base case', 'Further from the base case', 'To a global variable', 'Back to the start'],
      explanation: 'Progress toward the base case guarantees it ends.', quote: 'Each recursive call must move the problem closer to the base case.' },
    { id: 'c4', sub: 2, page: 9, prompt: 'Type the name of the memory structure that holds recursive calls.',
      accept: ['call stack', 'the call stack', 'stack', 'the stack'],
      explanation: 'Every call gets a frame on the call stack.', quote: 'Each call gets its own frame on the call stack.' },
    { id: 'd1', sub: 3, page: 10, prompt: 'What is the worst-case time of bubble sort?',
      choices: ['O(n^2)', 'O(n log n)', 'O(n)', 'O(log n)'],
      explanation: 'It can compare every pair of elements.', quote: 'Bubble sort is O(n^2) in the worst case.' },
    { id: 'd2', sub: 3, page: 11, prompt: 'Merge sort splits the list, sorts each half, then...',
      choices: ['Merges the halves', 'Reverses them', 'Swaps the middles', 'Throws one away'],
      explanation: 'Merging two sorted halves gives a sorted whole.', quote: 'Merge sort splits the list in half, sorts each half, then merges them.' },
    { id: 'd3', sub: 3, page: 11, prompt: 'What is the time complexity of merge sort?',
      choices: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(2^n)'],
      explanation: 'log n levels of splitting, n work per level.', quote: 'Merge sort runs in O(n log n) time.' },
    { id: 'd4', sub: 3, page: 12, prompt: 'Type the name of the sort that repeatedly swaps neighbours.',
      accept: ['bubble sort', 'bubble', 'bubblesort'],
      explanation: 'Big values bubble up to the end.', quote: 'Bubble sort repeatedly swaps neighbours that are out of order.' },
  ],
}

const DATA_STRUCTURES: Deck = {
  deck_id: 'mock-data-structures',
  name: 'Sample: Data Structures',
  main_topic: 'Data structures',
  slides: 6,
  subtopics: ['Stacks', 'Queues', 'Hash tables'],
  questions: [
    { id: 's1', sub: 0, page: 1, prompt: 'A stack removes items in which order?',
      choices: ['Last in, first out', 'First in, first out', 'Smallest first', 'Random order'],
      explanation: 'The last item pushed is the first popped.', quote: 'A stack is last in, first out (LIFO).' },
    { id: 's2', sub: 0, page: 2, prompt: 'Which operation adds to a stack?',
      choices: ['Push', 'Enqueue', 'Insert at tail', 'Hash'],
      explanation: 'Push adds to the top; pop removes from it.', quote: 'Push adds an item to the top of the stack.' },
    { id: 'q1', sub: 1, page: 3, prompt: 'A queue removes items in which order?',
      choices: ['First in, first out', 'Last in, first out', 'Largest first', 'Random order'],
      explanation: 'Like a real queue: first come, first served.', quote: 'A queue is first in, first out (FIFO).' },
    { id: 'q2', sub: 1, page: 4, prompt: 'Which operation adds to a queue?',
      choices: ['Enqueue', 'Push', 'Pop', 'Peek'],
      explanation: 'Enqueue adds at the back, dequeue takes from the front.', quote: 'Enqueue adds an item to the back of the queue.' },
    { id: 'h1', sub: 2, page: 5, prompt: 'Average lookup time in a hash table?',
      choices: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
      explanation: 'The hash jumps straight to the bucket.', quote: 'Hash tables give O(1) lookups on average.' },
    { id: 'h2', sub: 2, page: 6, prompt: 'Two keys landing in the same bucket is called...',
      choices: ['A collision', 'A rotation', 'An overflow', 'A merge'],
      explanation: 'Collisions are handled by chaining or probing.', quote: 'When two keys hash to the same bucket, that is a collision.' },
  ],
}

const decks: Deck[] = [ALGORITHMS, DATA_STRUCTURES]

const LEVEL_INFO: Record<number, { biome: string; boss: string; minion: string }> = {
  1: { biome: 'Underground', boss: 'Minotaur', minion: 'Torchmite' },
  2: { biome: 'Stormy cave', boss: 'Hydra', minion: 'Brinecrab' },
  3: { biome: 'Dead forest', boss: 'Thornhart', minion: 'Hollow Crow' },
  4: { biome: 'Snowy mountain', boss: 'Yeti', minion: 'Frost Imp' },
  5: { biome: 'Volcano', boss: 'Phoenix', minion: 'Cinder Slug' },
}

const TAUNTS = {
  miss: ['Your notes betray you!', 'Was that on the slide? It was.', 'Reread that one, climber.', 'Ha! Wrong page.'],
  hit: ['A lucky strike...', 'You read that slide.', 'Grr. Correct.', 'The mountain shakes!'],
}

const ITEM_POOL: Item[] = [
  { item_id: 'split_rune', name: 'Split Rune' },
  { item_id: 'sages_whisper', name: "Sage's Whisper" },
  { item_id: 'heartstone', name: 'Heartstone' },
  { item_id: 'aegis_ward', name: 'Aegis Ward' },
]

const BLITZ_MS = 10_000
const MAX_HP = 5

interface MockFightQ {
  pub: FightQuestion
  src: Q
  deck: Deck
  order: number[] // shuffled index -> original index
  answer: number // index of the correct choice after shuffling (-1 for typed)
}

interface MockFight {
  node: MapNode
  questions: Map<string, MockFightQ>
  queue: string[]
  enemyHp: number
  enemyMax: number
  deadline: number | null
}

interface MockRun {
  run_id: string
  user_id: string
  player_name: string
  deck: Deck
  nodes: MapNode[]
  subOf: Map<string, number>
  hp: number
  status: 'active' | 'won' | 'lost'
  fight: MockFight | null
  items: Item[]
  shield: boolean
  started: number
  answered: number
  correct: number
  blitzBonus: number
  misses: { q: Q; deck: Deck }[]
  used: Set<string>
  reason: string | null
  bosses: string[]
  detoured: Set<number>
}

interface Attempt {
  user_id: string
  deck: Deck
  q: Q
  correct: boolean
}

const runs = new Map<string, MockRun>()
const attempts: Attempt[] = []
const scores = new Map<string, ScoreRow[]>()
const bests = new Map<string, number>()

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))
const uid = () => Math.random().toString(36).slice(2, 10)
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function trace(...fns: [string, number, number][]): TraceStep[] {
  return fns.map(([fn, ms, rows]) => ({ fn: `${fn} (mock)`, ms, rows }))
}

function summary(d: Deck): DeckSummary {
  return { deck_id: d.deck_id, name: d.name, main_topic: d.main_topic, source: 'mock', subtopics: d.subtopics, slides: d.slides }
}

function getRun(runId: string, userId?: string): MockRun {
  const run = runs.get(runId)
  if (!run) throw new ApiError(404, 'Unknown run')
  if (userId && run.user_id !== userId) throw new ApiError(403, 'This run belongs to another player')
  return run
}

function linkLinear(nodes: MapNode[]): void {
  nodes.forEach((n, i) => {
    n.next = i + 1 < nodes.length ? [nodes[i + 1].node_id] : []
  })
}

function buildNodes(deck: Deck, subOf: Map<string, number>): MapNode[] {
  const nodes: MapNode[] = []
  const levels = Math.min(deck.subtopics.length, 5)
  for (let i = 0; i < levels; i++) {
    const level = (i + 1) as Level
    const info = LEVEL_INFO[i + 1]
    const sub = deck.subtopics[i]
    const add = (node_id: string, kind: MapNode['kind'], enemy?: string) => {
      nodes.push({ node_id, kind, level, biome: info.biome, enemy, subtopic: sub, status: 'locked' })
      subOf.set(node_id, i)
    }
    add(`l${i + 1}e`, 'enemy', info.minion)
    if (i === 1) add(`l${i + 1}x`, 'blitz', info.minion)
    add(`l${i + 1}b`, 'miniboss', info.boss)
    if (i === 0 || i === 2) add(`l${i + 1}t`, 'treasure')
  }
  nodes.push({ node_id: 'summit', kind: 'boss', level: 'summit', biome: 'Cloudy summit', enemy: 'Retep', subtopic: deck.main_topic, status: 'locked' })
  nodes[0].status = 'open'
  linkLinear(nodes)
  return nodes
}

function mapState(run: MockRun): RunMap {
  const current = run.nodes.find((n) => n.status === 'open') ?? null
  return clone({
    run_id: run.run_id,
    deck_id: run.deck.deck_id,
    deck_name: run.deck.name,
    main_topic: run.deck.main_topic,
    hp: run.hp,
    max_hp: MAX_HP,
    items: run.items,
    map: run.nodes,
    current_node_id: current?.node_id ?? null,
    run_status: run.status,
    reason: run.reason,
    player_name: run.player_name,
    score: run.correct * 100 + run.blitzBonus,
  })
}

function missCount(userId: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const a of attempts) if (a.user_id === userId) m.set(a.q.id, (m.get(a.q.id) ?? 0) + (a.correct ? 0 : 1))
  return m
}

function ranked(qs: Q[], run: MockRun): Q[] {
  const hist = missCount(run.user_id)
  return shuffle(qs).sort((x, y) => {
    const rank = (q: Q) => [run.used.has(q.id) ? 1 : 0, hist.has(q.id) ? (hist.get(q.id)! > 0 ? 0 : 2) : 1, -(hist.get(q.id) ?? 0)]
    const a = rank(x)
    const b = rank(y)
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
  })
}

function makeQ(node: MapNode, i: number, src: Q, deck: Deck, slot: FightQuestion['slot'], timed: boolean, reword = false): MockFightQ {
  const typed = !src.choices
  const order = typed ? [] : shuffle(src.choices!.map((_, j) => j))
  const pub: FightQuestion = {
    q_id: `${node.node_id}.${i}`,
    prompt: reword && src.reword ? src.reword : src.prompt,
    choices: typed ? [] : order.map((j) => src.choices![j]),
    subtopic: deck.subtopics[src.sub],
    deck_name: deck.name,
    slot,
    type: typed ? 'typed' : 'mc',
  }
  if (timed) pub.time_limit_ms = BLITZ_MS
  return { pub, src, deck, order, answer: typed ? -1 : order.indexOf(0) }
}

function buildFight(run: MockRun, node: MapNode): MockFight {
  const picked: MockFightQ[] = []
  const deck = run.deck
  const add = (src: Q, d: Deck = deck, slot: FightQuestion["slot"] = null, reword = false) => {
    picked.push(makeQ(node, picked.length, src, d, slot, node.kind === 'blitz', reword))
    run.used.add(src.id)
  }
  const sub = run.subOf.get(node.node_id)
  const pool = deck.questions.filter((q) => q.sub === sub)
  const mcOnly = (qs: Q[]) => qs.filter((q) => q.choices)
  if (node.kind === 'enemy') ranked(mcOnly(pool), run).slice(0, 2).forEach((q) => add(q))
  else if (node.kind === 'blitz') ranked(mcOnly(deck.questions), run).slice(0, 4).forEach((q) => add(q))
  else if (node.kind === 'miniboss') {
    const mc = ranked(mcOnly(pool), run).slice(0, 2)
    const typed = pool.find((q) => !q.choices)
    mc.forEach((q) => add(q))
    if (typed) add(typed)
    else ranked(mcOnly(pool), run).slice(2, 3).forEach((q) => add(q))
  } else {
    const latest = run.misses.length ? run.misses[run.misses.length - 1] : null
    if (latest) add(latest.q, latest.deck, 'memory', true)
    const other = decks.find((d) => d.deck_id !== deck.deck_id)
    if (other) ranked(mcOnly(other.questions), run).slice(0, 2).forEach((q) => add(q, other, 'other_lecture'))
    const rest = ranked(deck.questions, run).filter((q) => !picked.some((p) => p.src.id === q.id))
    for (const q of rest) {
      if (picked.length >= 8) break
      add(q)
    }
  }
  const questions = new Map(picked.map((p) => [p.pub.q_id, p]))
  return {
    node,
    questions,
    queue: [...questions.keys()],
    enemyHp: picked.length,
    enemyMax: picked.length,
    deadline: node.kind === 'blitz' ? Date.now() + BLITZ_MS : null,
  }
}

function fightState(run: MockRun): Fight {
  const f = run.fight!
  return clone({
    kind: f.node.kind as Fight['kind'],
    node_id: f.node.node_id,
    level: f.node.level,
    biome: f.node.biome,
    subtopic: f.node.subtopic ?? '',
    enemy: { name: f.node.enemy ?? 'Enemy', hp: f.enemyHp, max_hp: f.enemyMax },
    questions: [...f.questions.values()].map((q) => q.pub),
    current_q_id: f.queue[0] ?? null,
    player_hp: run.hp,
    max_hp: MAX_HP,
    trace: f.node.kind === 'boss' ? trace(['AI_COMPLETE (reword)', 640, 1], ['VECTOR_COSINE_SIMILARITY', 85, 8]) : [],
    time_left_ms: f.deadline ? Math.max(0, f.deadline - Date.now()) : null,
  })
}

function openNext(run: MockRun, from: MapNode): MapNode | null {
  const nextId = from.next?.[0]
  const next = run.nodes.find((n) => n.node_id === nextId) ?? null
  if (next) next.status = 'open'
  return next
}

function finish(run: MockRun, won: boolean): RunOver {
  run.status = won ? 'won' : 'lost'
  run.fight = null
  const score = run.correct * 100 + run.blitzBonus + run.hp * 50 + (won ? 500 : 0)
  const key = `${run.user_id}:${run.deck.deck_id}`
  bests.set(key, Math.max(bests.get(key) ?? 0, score))
  const time_s = Math.round((Date.now() - run.started) / 1000)
  const list = scores.get(run.deck.deck_id) ?? []
  list.push({ player_name: run.player_name, score, accuracy: run.answered ? run.correct / run.answered : 0, time_s, at: Date.now() })
  scores.set(run.deck.deck_id, list)
  const weak = new Map<string, number>()
  for (const m of run.misses) {
    const name = m.deck.subtopics[m.q.sub]
    weak.set(name, (weak.get(name) ?? 0) + 1)
  }
  return {
    won,
    score,
    best_score: bests.get(key)!,
    answered: run.answered,
    correct: run.correct,
    accuracy: run.answered ? Math.round((run.correct / run.answered) * 100) / 100 : 0,
    time_s,
    hp_left: run.hp,
    weak_spots: [...weak.entries()].sort((a, b) => b[1] - a[1]).map(([subtopic, missed]) => ({ subtopic, missed })),
    bosses_beaten: run.bosses.slice(),
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function clearNode(run: MockRun, f: MockFight): RunOver | null {
  f.node.status = 'cleared'
  run.fight = null
  if (f.node.kind === 'miniboss' || f.node.kind === 'boss') run.bosses.push(f.node.enemy ?? '')
  if (f.node.kind === 'boss') return finish(run, true)
  // Performance picks the path: missed a mini boss question? Detour through that subtopic once more.
  const sub = run.subOf.get(f.node.node_id)
  const missedHere = [...f.questions.values()].some((q) => run.misses.some((m) => m.q.id === q.src.id))
  run.reason = null
  if (f.node.kind === 'miniboss' && missedHere && sub !== undefined && !run.detoured.has(sub)) {
    run.detoured.add(sub)
    const info = LEVEL_INFO[sub + 1]
    const detour: MapNode = {
      node_id: `l${sub + 1}d`, kind: 'enemy', level: f.node.level, biome: info.biome, enemy: info.minion,
      subtopic: run.deck.subtopics[sub], status: 'open', next: f.node.next,
    }
    run.subOf.set(detour.node_id, sub)
    f.node.next = [detour.node_id]
    run.nodes.splice(run.nodes.indexOf(f.node) + 1, 0, detour)
    run.reason = `The path bends back: your weak spot in ${run.deck.subtopics[sub]} awaits.`
    return null
  }
  const next = openNext(run, f.node)
  if (next?.kind === 'treasure') run.reason = 'A glint of gold! Your sharp answers found a treasure trove.'
  else if (next?.kind === 'blitz') run.reason = 'Lightning-quick foes ahead: a Blitz!'
  return null
}

export const mockBackend: Backend = {
  async health() {
    await delay(50)
    return { ok: true, snowflake: false, error: 'mock backend' }
  },
  async decks() {
    await delay()
    return { decks: decks.map(summary), snowflake_error: null }
  },
  async upload(file, name) {
    await delay(3200)
    if (!name.trim()) throw new ApiError(400, 'Give the cartridge a name')
    const base = ALGORITHMS
    const deck: Deck = { ...base, deck_id: `mock-${uid()}`, name: name.trim().slice(0, 80) }
    decks.push(deck)
    return {
      deck_id: deck.deck_id,
      name: deck.name,
      main_topic: deck.main_topic,
      subtopics: deck.subtopics.map((s, i) => ({ subtopic_no: i + 1, name: s, chunks: 3, questions: deck.questions.filter((q) => q.sub === i).length })),
      slides: deck.slides,
      chunks: 12,
      trace: trace(
        [`AI_PARSE_DOCUMENT ${file.name}`, 2100, deck.slides],
        ['SPLIT_TEXT_RECURSIVE_CHARACTER', 120, 12],
        ['AI_EMBED', 900, 12],
        ['AI_COMPLETE (questions)', 4300, deck.questions.length],
      ),
    }
  },
  async startRun(userId, deckId, playerName) {
    await delay()
    const deck = decks.find((d) => d.deck_id === deckId)
    if (!deck) throw new ApiError(404, 'Unknown cartridge')
    const subOf = new Map<string, number>()
    const run: MockRun = {
      run_id: uid(), user_id: userId, player_name: playerName, deck, nodes: buildNodes(deck, subOf), subOf,
      hp: MAX_HP, status: 'active', fight: null, items: [], shield: false, started: Date.now(), answered: 0,
      correct: 0, blitzBonus: 0, misses: [], used: new Set(), reason: null, bosses: [], detoured: new Set(),
    }
    runs.set(run.run_id, run)
    return mapState(run)
  },
  async map(runId) {
    await delay(80)
    return mapState(getRun(runId))
  },
  async enterNode(runId, nodeId): Promise<NodeResult> {
    await delay(nodeId === 'summit' ? 700 : 200)
    const run = getRun(runId)
    if (run.status !== 'active') throw new ApiError(409, 'This run is over')
    const node = run.nodes.find((n) => n.node_id === nodeId)
    if (!node) throw new ApiError(404, 'Unknown node')
    if (run.fight?.node.node_id === nodeId) return fightState(run)
    if (node.status !== 'open') throw new ApiError(409, 'That node is not open')
    if (node.kind === 'treasure') {
      const choices = shuffle(ITEM_POOL).slice(0, 3)
      return { kind: 'treasure', node_id: node.node_id, level: node.level, choices: choices.map((c, i) => ({ choice_id: `c${i}`, item_id: c.item_id, name: c.name })) }
    }
    run.fight = buildFight(run, node)
    return fightState(run)
  },
  async answer(req: AnswerRequest) {
    await delay(220)
    const run = getRun(req.run_id, req.user_id)
    const f = run.fight
    if (run.status !== 'active' || !f) throw new ApiError(409, 'No fight in progress')
    if (f.queue[0] !== req.q_id) throw new ApiError(409, 'Answer the current question first')
    const fq = f.questions.get(req.q_id)!
    const timedOut = f.deadline !== null && Date.now() > f.deadline + 300
    if (!timedOut && (req.choice === null || req.choice === undefined) && !req.text) {
      if (f.deadline !== null) throw new ApiError(409, 'There is still time')
      throw new ApiError(400, 'Send choice or text')
    }
    let correct = false
    if (!timedOut) {
      if (fq.pub.type === 'typed') correct = (fq.src.accept ?? []).includes(norm(req.text ?? ''))
      else correct = req.choice === fq.answer
    }
    run.answered++
    attempts.push({ user_id: run.user_id, deck: fq.deck, q: fq.src, correct })
    f.queue.shift()
    let blocked = false
    if (correct) {
      run.correct++
      f.enemyHp--
      if (f.node.kind === 'blitz') run.blitzBonus += 50
    } else {
      if (run.shield) {
        run.shield = false
        blocked = true
      } else run.hp--
      run.misses.push({ q: fq.src, deck: fq.deck })
      if (f.node.kind !== 'blitz') f.queue.push(req.q_id)
    }
    const cleared = f.enemyHp <= 0 || (f.node.kind === 'blitz' && f.queue.length === 0)
    let runOver: RunOver | null = null
    if (run.hp <= 0) runOver = finish(run, false)
    else if (cleared) runOver = clearNode(run, f)
    if (!cleared && f.deadline !== null) f.deadline = Date.now() + BLITZ_MS
    const answerText = fq.pub.type === 'typed' ? (fq.src.accept?.[0] ?? '') : fq.pub.choices[fq.answer]
    const res: AnswerResult = {
      correct,
      answer: { index: fq.answer, text: answerText },
      explanation: fq.src.explanation,
      taunt: TAUNTS[correct ? 'hit' : 'miss'][Math.floor(Math.random() * 4)],
      quote: correct ? null : { text: fq.src.quote, page: fq.src.page, deck_name: fq.deck.name },
      player_hp: Math.max(run.hp, 0),
      enemy_hp: Math.max(f.enemyHp, 0),
      node_cleared: cleared,
      next_q_id: !cleared && run.status === 'active' ? (f.queue[0] ?? null) : null,
      run_status: run.status,
      run_over: runOver,
      timed_out: timedOut,
      time_left_ms: !cleared && f.deadline !== null ? BLITZ_MS : null,
      score: run.correct * 100 + run.blitzBonus,
      blocked,
    }
    return res
  },
  async report(userId): Promise<Report> {
    await delay()
    const mine = attempts.filter((a) => a.user_id === userId)
    const groups = new Map<string, Report['subtopics'][number] & { misses: Map<string, { page: number; text: string; missed: number }> }>()
    for (const a of mine) {
      const key = `${a.deck.deck_id}:${a.q.sub}`
      const g = groups.get(key) ?? { deck_id: a.deck.deck_id, deck_name: a.deck.name, subtopic: a.deck.subtopics[a.q.sub], answered: 0, correct: 0, accuracy: 0, misses: new Map() }
      g.answered++
      if (a.correct) g.correct++
      else {
        const m = g.misses.get(a.q.quote) ?? { page: a.q.page, text: a.q.quote, missed: 0 }
        m.missed++
        g.misses.set(a.q.quote, m)
      }
      groups.set(key, g)
    }
    const subtopics = [...groups.values()]
      .map(({ misses, ...g }) => ({
        ...g,
        accuracy: Math.round((g.correct / g.answered) * 100) / 100,
        missed_slides: [...misses.values()].sort((a, b) => b.missed - a.missed).slice(0, 3),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
    const correct = mine.filter((a) => a.correct).length
    const finished = [...runs.values()].filter((r) => r.user_id === userId && r.status !== 'active')
    return {
      subtopics,
      stats: {
        answered: mine.length,
        correct,
        accuracy: mine.length ? Math.round((correct / mine.length) * 100) / 100 : 0,
        runs_finished: finished.length,
        best_score: Math.max(0, ...[...bests.entries()].filter(([k]) => k.startsWith(userId)).map(([, v]) => v)),
      },
    }
  },
  async treasure(runId, nodeId, choiceId) {
    await delay(300)
    const run = getRun(runId)
    const node = run.nodes.find((n) => n.node_id === nodeId)
    if (!node || node.kind !== 'treasure' || node.status !== 'open') throw new ApiError(409, 'No treasure here')
    const idx = Number(choiceId.slice(1))
    const item = ITEM_POOL[idx % ITEM_POOL.length]
    const have = run.items.find((i) => i.item_id === item.item_id)
    if (have) have.count = (have.count ?? 1) + 1
    else run.items.push({ ...item, count: 1 })
    node.status = 'cleared'
    run.reason = null
    openNext(run, node)
    return { items: clone(run.items), hp: run.hp, max_hp: MAX_HP }
  },
  async useItem(runId, itemId, qId) {
    await delay(150)
    const run = getRun(runId)
    const have = run.items.find((i) => i.item_id === itemId)
    if (!have || (have.count ?? 1) <= 0) throw new ApiError(409, 'You do not have that item')
    const f = run.fight
    const fq = qId && f ? f.questions.get(qId) : undefined
    const result: { remove?: number[]; hint?: string; shield?: boolean } = {}
    if (itemId === 'split_rune') {
      if (!fq || fq.pub.type === 'typed') throw new ApiError(409, 'The rune needs a multiple-choice question')
      result.remove = shuffle(fq.pub.choices.map((_, i) => i).filter((i) => i !== fq.answer)).slice(0, 2)
    } else if (itemId === 'sages_whisper') {
      if (!fq) throw new ApiError(409, 'The sage has nothing to whisper')
      result.hint = `Think of slide ${fq.src.page}: "${fq.src.quote.split(' ').slice(0, 5).join(' ')}..."`
    } else if (itemId === 'heartstone') {
      run.hp = Math.min(MAX_HP, run.hp + 1)
    } else if (itemId === 'aegis_ward') {
      run.shield = true
      result.shield = true
    } else throw new Unsupported(itemId)
    have.count = (have.count ?? 1) - 1
    run.items = run.items.filter((i) => (i.count ?? 1) > 0)
    return { items: clone(run.items), player_hp: run.hp, ...result }
  },
  async scores(deckId) {
    await delay(100)
    const list = (scores.get(deckId) ?? []).slice().sort((a, b) => b.score - a.score).slice(0, 8)
    return { scores: list }
  },
}
