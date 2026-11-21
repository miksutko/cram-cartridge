export type Level = number | 'summit'

export interface Health {
  ok: boolean
  snowflake: boolean
  version?: string
  error?: string
}

export interface DeckSummary {
  deck_id: string
  name: string
  main_topic: string
  source: 'demo' | 'snowflake'
  subtopics: string[] | null
  slides: number
}

export interface TraceStep {
  fn: string
  ms: number
  rows: number
  error?: string
}

export interface TraceEntry {
  id: number
  label: string
  steps: TraceStep[]
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

export interface MapNode {
  node_id: string
  kind: 'miniboss' | 'boss'
  level: Level
  biome: string
  enemy: string
  subtopic: string
  status: 'locked' | 'open' | 'cleared'
}

export interface RunMap {
  run_id: string
  deck_id: string
  deck_name: string
  main_topic: string
  hp: number
  max_hp: number
  items: unknown[]
  map: MapNode[]
  current_node_id: string | null
  run_status: 'active' | 'won' | 'lost'
}

export interface FightQuestion {
  q_id: string
  prompt: string
  choices: string[]
  subtopic: string
  deck_name: string
  slot: 'memory' | 'other_lecture' | null
}

export interface Fight {
  kind: 'miniboss' | 'boss'
  node_id: string
  level: Level
  biome: string
  subtopic: string
  enemy: { name: string; hp: number; max_hp: number }
  questions: FightQuestion[]
  current_q_id: string | null
  player_hp: number
  max_hp: number
  trace: TraceStep[]
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
  weak_spots: { subtopic: string; missed: number }[]
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
  run_status: 'active' | 'won' | 'lost'
  run_over: RunOver | null
}

export interface Report {
  subtopics: {
    deck_id: string
    deck_name: string
    subtopic: string
    answered: number
    correct: number
    accuracy: number
  }[]
  stats: { answered: number; correct: number; accuracy: number; runs_finished: number; best_score: number }
}
