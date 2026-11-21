# Frontend → backend handoff

Written by the frontend owner for Maksym (backend/ and sql/). The frontend already
handles everything below: each feature switches on as soon as the server sends the
field or endpoint, and degrades gracefully until then. The mock backend
(`frontend/src/api/mock.ts`, use `?mock=1`) implements all of it, so it is a working
reference for the exact shapes.

Already done on the backend (thank you): `GET /api/decks`, `player_name` on
`POST /api/run`, `GET /api/scores`, `missed_slides` in the report.

## What players see today on the real backend vs the design doc

The real game is still the MVP climb: 3 mini bosses + the dragon. The design doc and
the frontend also have regular enemies, treasure troves, Blitz, typed answers,
power-ups, performance-picked paths and levels 4-5 (Yeti, Phoenix). Those only appear
when the server sends them. In priority order:

### 1. Regular enemies, treasure and Blitz nodes (map)

`map[]` nodes may have `kind` = `enemy | miniboss | treasure | blitz | boss` (already in
the contract). Suggested climb per subtopic level: `enemy` (2 questions) → `miniboss`
(3 questions), plus a `treasure` node after levels 1 and 3 and a `blitz` node in level 2.
Every node keeps `level` (1-5 or "summit"), `biome`, `enemy`, `subtopic`, `status`.

Regular enemy names per level (frontend has sprites for these):
1 Torchmite · 2 Brinecrab · 3 Hollow Crow · 4 Frost Imp · 5 Cinder Slug.
Boss names the frontend shows: Minotaur, **Hydra** (server says "Kraken"),
**Thornhart** (server says "Forest beast"), Yeti, Phoenix, **Retep** (server says
"Dragon"). The frontend maps the old names, but sending the new ones keeps taunts and
results consistent.

### 2. Levels 4 and 5

`MVP_LEVELS = 3` in `game.py` caps the climb. Raising it to 5 lets cartridges with 4-5
subtopics reach the Yeti and the Phoenix (art and biomes are ready).

### 3. Performance-picked path (PROPOSED fields)

```
MapNode.next?: string[]         // ids this node leads to; missing = linear
RunMap.reason?: string | null   // why the server picked the current node, shown as a banner
```
The mock's rule: miss a question in a mini boss → insert one extra `enemy` node on that
subtopic before moving on, with reason
`"The path bends back: your weak spot in <subtopic> awaits."`.

### 4. Treasure (PROPOSED)

`POST /api/node` on a treasure node:
```
{ kind: "treasure", node_id, level, choices: [{ choice_id, item_id, name?, desc? }] }
```
`POST /api/treasure {run_id, node_id, choice_id} -> { items: Item[], hp, max_hp }`
(clears the node and opens the next). `Item = { item_id, name?, count? }`.
Item ids the frontend knows: `split_rune` (Fifty-Fifty), `sages_whisper` (Hint),
`heartstone` (Extra Heart), `aegis_ward` (Shield). Unknown ids get a generic icon.

### 5. Using items (PROPOSED)

`POST /api/item {run_id, item_id, q_id} -> { items, player_hp, remove?: number[], hint?: string, shield?: boolean }`
- split_rune → `remove`: two wrong choice indexes to hide (never reveals the right one)
- sages_whisper → `hint`: a short nudge from the slide
- heartstone → `player_hp` + 1
- aegis_ward → `shield: true`; the next miss returns `blocked: true` in `/api/answer` and costs no HP

### 6. Blitz timing (PROPOSED; the server owns all timing)

- Each blitz question: `FightQuestion.time_limit_ms` (10000).
- `Fight.time_left_ms` and `AnswerResult.time_left_ms`: ms left on the current/next question.
- When its countdown reaches 0 the client sends `/api/answer` with `choice: null, text: null`.
  If time is really up, answer with `timed_out: true` (counts as a miss); if not, 409 and
  the client asks again shortly. Blitz misses do not come back later in the fight.
- `AnswerResult.score?: number` (running score) is shown in the HUD when present.

### 7. Typed answers (PROPOSED)

`FightQuestion.type?: "mc" | "typed"` (missing = "mc"); typed questions have `choices: []`.
The client sends `text` instead of `choice` (the request model already has `text`;
`game.answer` currently ignores it). Bosses mix in typed questions; regular enemies stay
multiple choice. `answer.text` in the response should be the accepted answer.

### 8. Dev mode trace detail (PROPOSED, optional)

`TraceStep.detail?: unknown`: matched chunks / similarity scores for the dev "debug port".

## Proposed text for shared files (please add when convenient)

README.md, under a new "Art and audio" heading:

> All game art (sprites, backgrounds, icons, the console frame) is original and drawn in
> code in `frontend/src/art/`; nothing is copied from existing games. The designer can
> replace any sprite by dropping `frontend/src/assets/sprites/<id>.png` (see the
> `#/gallery` page). Music goes in `frontend/src/assets/music/` by slot name and is
> played through a retro filter; every track must be licensed for this use and
> credited below.

Music credits (titles chosen by the team; files are not in the repo yet, and the licence
for each must be confirmed before they are added):

| Slot | Track |
|---|---|
| title | "The Throne is Mine" by Ruiqi Zhao |
| level1 (Underground) | "At All Costs" by Dream Cave |
| level2 (Stormy cave) | "A Sinking Ship" by Wendel Scherer |
| level3 (Dead forest) | "The End is Nigh" by Max Anson |
| level4 (Snowy mountain) | "Anomaly" by Christoffer Moe Ditlevsen |
| level5 (Volcano) | "Howling Hell" by Jon Bjork |
| summit (also the Retep fight) | "Epic Triumph" by Elm Lake |

CLAUDE.md: the "Art: [PENDING ...]" line can become "Art: full-colour pixel art inside
an original handheld frame, drawn in code (frontend/src/art)".
