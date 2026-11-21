# How Cram Cartridge uses Snowflake

Every AI step in Cram Cartridge is a SQL function that runs inside Snowflake: reading the PDF,
chunking it, embedding it, writing questions and matching them by meaning. The Python backend only
moves rows and checks the model's JSON. The slides, the questions, their vectors and every answer a
player gives live in one database.

## Why Snowflake

- **No extra services.** PDF parsing, embeddings, an LLM and vector search are all built-in SQL
  functions, so there is no separate vector database, model host or PDF library to run.
- **Data and AI together.** Questions are generated next to the slide text they quote, and the
  dragon's vector search runs over every cartridge a player has uploaded.
- **Memory that lasts.** Answers, scores and runs are rows in the same database, so weak spots
  follow a player across lectures and survive a server restart.

## Upload: PDF to cartridge

One `POST /api/upload`. A 44-page lecture takes about 60 seconds; the timings below are from real
uploads of the test lectures.

```mermaid
flowchart LR
  PDF[Lecture PDF] -->|PUT| ST[(@slides stage, SSE)]
  ST -->|AI_PARSE_DOCUMENT| SL[slides: one row per page]
  SL -->|SPLIT_TEXT_RECURSIVE_CHARACTER| CH[chunks]
  CH -->|AI_EMBED| CHV[chunk vectors]
  SL -->|AI_COMPLETE| TOP[main topic + 3-5 subtopics]
  TOP -->|AI_EMBED| TV[subtopic vectors]
  CHV & TV -->|VECTOR_COSINE_SIMILARITY| ASG[each chunk joins its closest subtopic]
  ASG -->|AI_COMPLETE per subtopic| Q[questions with page + exact quote]
  Q -->|AI_EMBED| QV[question vectors]
```

| Step | Snowflake function | What it produces | Time |
|---|---|---|---|
| Store the PDF | `PUT @slides` (server-side encrypted stage) | the file, ready for parsing | 2.5 s |
| Read it | `AI_PARSE_DOCUMENT` (`LAYOUT`, `page_split`) | `slides`: one row per page, tables and maths kept | 11-19 s |
| Chunk it | `SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER` | `chunks` with their page number | 2.5-4 s |
| Embed chunks | `AI_EMBED('snowflake-arctic-embed-l-v2.0')` | 1024-d vector per chunk | 2 s |
| Find the topics | `AI_COMPLETE('llama3.1-70b')` | main topic and 3-5 subtopics (the levels) | 4 s |
| Sort chunks into levels | `AI_EMBED` + `VECTOR_COSINE_SIMILARITY` | every chunk assigned to its closest subtopic | 2-4 s |
| Write questions | `AI_COMPLETE('llama3.1-70b')`, one call per subtopic in a single statement | 5 multiple-choice questions per level, each with the page and the slide sentence it comes from | 20-25 s |
| Embed questions | `AI_EMBED` | 1024-d vector per question, for the dragon | 1 s |

Uploading the same PDF again matches its SHA-256 and returns the existing cartridge instantly.
Each step's function, time and row count comes back in the response's `trace`, which the game shows
in its Snowflake panel.

## In the game

- **Every miss quotes your own slide.** Each question stores the page and the exact sentence it was
  written from, checked against the parsed slide text. A wrong answer shows that quote with its page.
- **The dragon remembers.** At the summit, `AI_COMPLETE` rewords your latest mistake as the first
  question. At the same time `VECTOR_COSINE_SIMILARITY` ranks every question on every cartridge
  against that mistake. The two closest questions from *other* lectures become the dragon's second
  and third questions, with the score shown, and the rest of the fight leans towards the concept you
  missed. Real example: a miss on *"What is the contrapositive of P → Q?"* (Lecture 2) brought in
  *"What is the result of the logical consequence P, P → Q ⊨ Q?"* from Lecture 3 (similarity 0.606).
- **Replays target weak spots.** Every answer is a row in `attempts`. Missed questions come first
  on the next climb, and the results screen lists the slides missed most.
- **Nothing is lost on restart.** Answers, scores (high-score table) and run snapshots are written
  to Snowflake in the background and read back after a restart, so a climb continues where it left off.

## Tables

`decks`, `slides`, `chunks`, `subtopics`, `questions` (with `embedding`), `attempts`, `scores`,
`runs`, plus the `@slides` stage. Schema: [`sql/01_ingest.sql`](sql/01_ingest.sql). Every query the
backend runs: [`sql/02_queries.sql`](sql/02_queries.sql).

## Guard rails

- All SQL lives in `sql/*.sql` and runs with bound parameters (`%(name)s`).
- Snowflake credentials live only in `.env` on the server and never reach the browser.
- The game never sends the correct answer to the browser before the player answers.
- Model output is untrusted: the backend repairs and validates the JSON, keeps only questions with
  exactly four distinct choices, and checks every quote against the slide text.
- Cost: an X-Small warehouse that suspends after 60 idle seconds, capped by a 20-credit resource
  monitor. A full lecture upload costs cents.
