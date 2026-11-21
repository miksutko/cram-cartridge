# Cram Cartridge

Current phase: BUILD MVP

Hackathon web app built with JetBrains Air (required rule). KCL Tech First Year Hack,
hard deadline 18:00 today. Simple and working beats clever. MVP first.

## The game (full detail: Game Design tab of our design doc)
Upload lecture notes to make a cartridge. Each cartridge is a fantasy climb up a
mountain: one level per subtopic, each level a biome with a mini boss, a dragon at
the summit. Every attack is a question from the player's own slides (multiple choice
or typed). Wrong answer: the enemy hits and quotes the exact slide missed, plus a
one-line explanation. How you perform picks your path. The dragon mixes the whole
topic and opens with a reworded version of your latest mistake; questions 2 and 3
come from a different lecture. Replaying a cartridge remembers your weak points.
Run ends with a high score and stats (accuracy, time).

Levels in order: 1 Underground (Minotaur), 2 Stormy cave (Kraken/Hydra),
3 Dead forest (forest beast), 4 Snowy mountain (Yeti), 5 Volcano (Phoenix),
summit Cloudy summit (Dragon). Fewer subtopics = fewer levels, then the summit.

Art: [PENDING: full-colour pixel art or 4-shade Game Boy green]. Pixel font
"Press Start 2P". Scenes 240x160 scaled 4x, crisp pixels. Original art or CC0
assets only; never copy art, characters or names from existing games.

## Scope
- MVP: start screen, cartridge shelf + upload, linear climb of 3 levels
  (one mini boss fight each, 3 multiple-choice questions) then the dragon
  (8 questions, memory slot + other-lecture slot), miss quotes, results screen,
  weak spots, Snowflake panel.
- After MVP, in order: high scores, typed answers, Blitz nodes, regular enemies per
  level, performance-picked branching paths, treasure troves and power-ups, settings
  and music, instruction manual, levels 4 and 5.

## Team and ownership
- Maksym: backend/ and sql/ (Snowflake). Teammate: frontend/. Designer: art and the
  Game Design tab; art files go into frontend/src/assets/ via the frontend owner.
- Each person edits only their own folders. Shared files (CLAUDE.md, AGENTS.md,
  .junie/, docs/, README.md) change only after telling the others.

## Stack
- frontend/: React + TypeScript + Vite. Plain CSS, no game engine, no UI kit.
- backend/: Python 3.11+, FastAPI, snowflake-connector-python, python-dotenv.
- sql/: all Snowflake SQL. DB CRAM, warehouse CRAM_WH, stage @slides.
  Models: snowflake-arctic-embed-l-v2.0 (1024 dims), llama3.1-70b.
- IDE: IntelliJ IDEA Ultimate with JetBrains Air.

## Commands
- Backend: uvicorn backend.main:app --reload --port 8000 (from the repo root)
- Frontend: cd frontend && npm run dev (Vite proxies /api to :8000)
- Start servers in the background, check they respond, then stop them.

## API contract (agree changes with the other side first)
- GET  /api/health -> {ok, snowflake, version | error}
- GET  /api/decks?user_id= -> {decks:[{deck_id, name, main_topic, source, subtopics, slides}], snowflake_error}
- POST /api/upload  multipart file,name -> {deck_id, name, main_topic, subtopics, slides, chunks, trace}
                    (+ cached: true when the same PDF was uploaded before)
- POST /api/run     {user_id, deck_id, player_name?} -> {run_id, hp, max_hp, items, map, current_node_id, player_name}
- GET  /api/map?run_id= -> {run_id, main_topic, hp, max_hp, items, map, current_node_id}
- POST /api/node    {run_id, node_id} -> fight {kind, enemy, questions, current_q_id, trace} | treasure {kind, choices}
- POST /api/answer  {user_id, run_id, q_id, choice | text} -> {correct, answer, explanation,
                    taunt, quote|null, player_hp, enemy_hp, node_cleared, next_q_id, run_status,
                    run_over|null}; a missed question comes back as next_q_id later in the same fight
- GET  /api/report?user_id= -> {subtopics:[... missed_slides], stats}
- GET  /api/scores?deck_id= -> {scores:[{player_name, score, accuracy, time_s, at}]} (top 10)
- Node kinds: enemy, miniboss, treasure, blitz, boss. Each node carries its level
  (1 to 5 or summit) so the frontend picks the biome background.

## Rules
- The server owns run state and all timing. The UI only displays it.
- Snowflake credentials only in .env at the repo root. Never commit .env, never send
  keys to the browser, never hardcode them.
- SQL lives in sql/*.sql and runs with bound parameters %(name)s. No f-strings with
  user input.
- AI work happens in Snowflake (AI_PARSE_DOCUMENT, SPLIT_TEXT_RECURSIVE_CHARACTER,
  AI_EMBED, VECTOR_COSINE_SIMILARITY, AI_COMPLETE), not in Python.
- Never send the correct answer to the browser before the player answers.
- Python imports: from backend.x import ..., never import x.
- Git: git pull --rebase before every push, small commits starting with "Air: ",
  never force-push main.
- No new dependencies without asking. One task per agent session.
