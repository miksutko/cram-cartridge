// Types for every request and response in the API contract (CLAUDE.md), matched to
// what backend/main.py returns today. Fields marked PROPOSED are additions the
// frontend asks for in frontend/HANDOFF.md; the UI works with or without them.

export type Level = 1 | 2 | 3 | 4 | 5 | 'summit'
export type NodeKind = 'enemy' | 'miniboss' | 'treasure' | 'blitz' | 'boss'
export type RunStatus = 'active' | 'won' | 'lost'

export interface Health {
  ok: boolean
  snowflake: boolean
  version?: string
  error?: string
}

export interface TraceStep {
  fn: string
  ms: number
  rows: number
  error?: string
  /** PROPOSED: matched chunks, similarity scores, anything else worth showing in dev mode. */
  detail?: unknown
}

export interface DeckSummary {
  deck_id: string
  name: string
  main_topic: string
  source: 'demo' | 'snowflake' | 'mock' | 'local'
  subtopics: string[] | null
  slides: number
}

export interface DecksResponse {
  decks: DeckSummary[]
  snowflake_error: string | null
}

export interface UploadResult {
  deck_id: string
  name: string
  main_topic: string
  subtopics: { subtopic_no: number; name: string; chunks: number; questions: number }[]
  slides: number
  chunks: number
  trace: TraceStep[]
}

export interface Item {
  item_id: string
  name?: string
  count?: number
}

export interface MapNode {
  node_id: string
  kind: NodeKind
  level: Level
  biome?: string
  enemy?: string
  subtopic?: string
  status: 'locked' | 'open' | 'cleared'
  /** PROPOSED: ids of the nodes this one leads to (branching map). Missing = linear. */
  next?: string[]
}

export interface RunMap {
  run_id: string
  deck_id: string
  deck_name: string
  main_topic: string
  hp: number
  max_hp: number
  items: Item[]
  map: MapNode[]
  current_node_id: string | null
  run_status: RunStatus
  /** PROPOSED: why the server picked the current node, e.g. a weak subtopic. */
  reason?: string | null
  /** PROPOSED */
  player_name?: string
  /** PROPOSED: running score. */
  score?: number
}

export interface FightQuestion {
  q_id: string
  prompt: string
  choices: string[]
  subtopic: string
  deck_name: string
  slot: 'memory' | 'other_lecture' | null
  /** PROPOSED: missing = "mc". */
  type?: 'mc' | 'typed'
  /** PROPOSED (Blitz): server-side time limit for this question. */
  time_limit_ms?: number
}

export interface Fight {
  kind: 'enemy' | 'miniboss' | 'blitz' | 'boss'
  node_id: string
  level: Level
  biome?: string
  subtopic: string
  enemy: { name: string; hp: number; max_hp: number }
  questions: FightQuestion[]
  current_q_id: string | null
  player_hp: number
  max_hp: number
  trace: TraceStep[]
  /** PROPOSED (Blitz): ms left on the current question when this response was sent. */
  time_left_ms?: number | null
}

export interface TreasureChoice {
  choice_id: string
  item_id: string
  name?: string
  desc?: string
}

/** PROPOSED: POST /api/node on a treasure node. */
export interface Treasure {
  kind: 'treasure'
  node_id: string
  level: Level
  choices: TreasureChoice[]
  trace?: TraceStep[]
}

export type NodeResult = Fight | Treasure

export interface WeakSpot {
  subtopic: string
  missed: number
}

export interface RunOver {
  won: boolean
  score: number
  best_score: number
  answered: number
  correct: number
  accuracy: number
  time_s: number
  hp_left: number
  weak_spots: WeakSpot[]
  /** PROPOSED */
  bosses_beaten?: string[]
}

export interface AnswerResult {
  correct: boolean
  answer: { index: number; text: string }
  explanation: string
  taunt: string
  quote: { text: string; page: number | null; deck_name: string } | null
  player_hp: number
  enemy_hp: number
  node_cleared: boolean
  next_q_id: string | null
  run_status: RunStatus
  run_over: RunOver | null
  /** PROPOSED (Blitz): the server decided time ran out. */
  timed_out?: boolean
  /** PROPOSED (Blitz): ms left on the next question. */
  time_left_ms?: number | null
  /** PROPOSED */
  score?: number
  /** PROPOSED: Aegis Ward absorbed this hit. */
  blocked?: boolean
}

export interface AnswerRequest {
  user_id: string
  run_id: string
  q_id: string
  choice?: number | null
  text?: string | null
}

/** PROPOSED: POST /api/treasure */
export interface TreasureResult {
  items: Item[]
  hp: number
  max_hp: number
}

/** PROPOSED: POST /api/item */
export interface ItemResult {
  items: Item[]
  player_hp: number
  /** Split Rune: choice indexes to hide. */
  remove?: number[]
  /** Sage's Whisper */
  hint?: string
  /** Aegis Ward */
  shield?: boolean
}

export interface ReportSubtopic {
  deck_id: string
  deck_name: string
  subtopic: string
  answered: number
  correct: number
  accuracy: number
  /** PROPOSED: slide pages missed most often. */
  missed_slides?: { page: number | null; text: string; missed: number }[]
}

export interface Report {
  subtopics: ReportSubtopic[]
  stats: { answered: number; correct: number; accuracy: number; runs_finished: number; best_score: number }
}

/** PROPOSED: GET /api/scores?deck_id= */
export interface ScoreRow {
  player_name: string
  score: number
  accuracy?: number
  time_s?: number
  at?: number
}

export interface ScoresResponse {
  scores: ScoreRow[]
}
