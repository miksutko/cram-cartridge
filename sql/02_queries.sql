-- Named queries used by the backend (backend/queries.py loads them by name).
-- Every value goes in as a bound parameter %(name)s. Do not use a literal
-- percent sign in this file: the connector treats it as a parameter marker.

-- name: put_pdf
-- {file_name} is a server-generated <uuid>.pdf (never user input); the bytes
-- are streamed with file_stream, so the local path part is ignored.
PUT file://{file_name} @slides AUTO_COMPRESS = FALSE OVERWRITE = TRUE;

-- name: refresh_stage
ALTER STAGE slides REFRESH;

-- name: insert_deck
INSERT INTO decks (deck_id, name, file_name, file_hash)
VALUES (%(deck_id)s, %(name)s, %(file_name)s, %(file_hash)s);

-- name: find_deck_by_hash
SELECT deck_id FROM decks
WHERE file_hash = %(file_hash)s AND status = 'ready'
ORDER BY created_at DESC
LIMIT 1;

-- name: parse_slides
INSERT INTO slides (deck_id, page_no, content)
SELECT %(deck_id)s, p.index + 1, p.value:content::STRING
FROM (
  SELECT AI_PARSE_DOCUMENT(
           TO_FILE('@slides', %(file_name)s),
           {'mode': 'LAYOUT', 'page_split': TRUE}) AS doc
) d,
LATERAL FLATTEN(input => d.doc:pages) p;

-- name: split_chunks
INSERT INTO chunks (deck_id, page_no, chunk_no, text)
SELECT s.deck_id, s.page_no, c.index, c.value::STRING
FROM slides s,
LATERAL FLATTEN(
  input => SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER(s.content, 'markdown', 1200, 150)
) c
WHERE s.deck_id = %(deck_id)s
  AND LENGTH(TRIM(c.value::STRING)) > 20;

-- name: embed_chunks
UPDATE chunks
SET embedding = AI_EMBED('snowflake-arctic-embed-l-v2.0', text)
WHERE deck_id = %(deck_id)s;

-- name: deck_text
SELECT LISTAGG('[page ' || page_no || '] ' || COALESCE(content, ''), '\n\n')
         WITHIN GROUP (ORDER BY page_no)
FROM slides
WHERE deck_id = %(deck_id)s;

-- name: complete
SELECT AI_COMPLETE('llama3.1-70b', %(prompt)s);

-- name: insert_subtopic
INSERT INTO subtopics (deck_id, subtopic_no, name, description)
VALUES (%(deck_id)s, %(subtopic_no)s, %(name)s, %(description)s);

-- name: embed_subtopics
UPDATE subtopics
SET embedding = AI_EMBED('snowflake-arctic-embed-l-v2.0', name || ': ' || COALESCE(description, ''))
WHERE deck_id = %(deck_id)s;

-- name: assign_subtopics
-- Each chunk gets the subtopic whose embedding is closest.
UPDATE chunks c
SET subtopic_no = best.subtopic_no
FROM (
  SELECT ch.page_no, ch.chunk_no, s.subtopic_no
  FROM chunks ch
  JOIN subtopics s ON s.deck_id = ch.deck_id
  WHERE ch.deck_id = %(deck_id)s
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY ch.page_no, ch.chunk_no
    ORDER BY VECTOR_COSINE_SIMILARITY(ch.embedding, s.embedding) DESC) = 1
) best
WHERE c.deck_id = %(deck_id)s
  AND c.page_no = best.page_no
  AND c.chunk_no = best.chunk_no;

-- name: generate_questions
-- One AI_COMPLETE per subtopic, all in one statement so Snowflake runs them together.
WITH material AS (
  SELECT s.subtopic_no, s.name,
         LISTAGG('[page ' || c.page_no || '] ' || c.text, '\n---\n')
           WITHIN GROUP (ORDER BY c.page_no, c.chunk_no) AS text
  FROM subtopics s
  JOIN chunks c ON c.deck_id = s.deck_id AND c.subtopic_no = s.subtopic_no
  WHERE s.deck_id = %(deck_id)s
  GROUP BY s.subtopic_no, s.name
)
SELECT subtopic_no,
       AI_COMPLETE('llama3.1-70b',
         %(instructions)s || '\n\nSUBTOPIC: ' || name || '\n\nSLIDES:\n' || LEFT(text, 12000)) AS reply
FROM material
ORDER BY subtopic_no;

-- name: deck_slides
SELECT page_no, content FROM slides WHERE deck_id = %(deck_id)s ORDER BY page_no;

-- name: insert_question
INSERT INTO questions (deck_id, q_no, subtopic_no, prompt, choices_json, answer_index, explanation, page_no, quote)
VALUES (%(deck_id)s, %(q_no)s, %(subtopic_no)s, %(prompt)s, %(choices_json)s, %(answer_index)s,
        %(explanation)s, %(page_no)s, %(quote)s);

-- name: finish_deck
UPDATE decks
SET main_topic = %(main_topic)s, slide_count = %(slide_count)s, chunk_count = %(chunk_count)s, status = 'ready'
WHERE deck_id = %(deck_id)s;

-- name: fail_deck
UPDATE decks SET status = 'failed' WHERE deck_id = %(deck_id)s;

-- name: list_decks
SELECT d.deck_id, d.name, d.main_topic, d.slide_count, d.chunk_count,
       COUNT(DISTINCT q.subtopic_no) AS subtopic_count
FROM decks d
LEFT JOIN questions q ON q.deck_id = d.deck_id
WHERE d.status = 'ready'
GROUP BY d.deck_id, d.name, d.main_topic, d.slide_count, d.chunk_count, d.created_at
ORDER BY d.created_at DESC;

-- name: subtopic_chunk_counts
SELECT subtopic_no, COUNT(*) FROM chunks WHERE deck_id = %(deck_id)s GROUP BY subtopic_no;

-- name: deck_info
SELECT name, main_topic, slide_count, chunk_count FROM decks WHERE deck_id = %(deck_id)s AND status = 'ready';

-- name: deck_subtopics
SELECT subtopic_no, name FROM subtopics WHERE deck_id = %(deck_id)s ORDER BY subtopic_no;

-- name: deck_questions
SELECT q_no, subtopic_no, prompt, choices_json, answer_index, explanation, page_no, quote
FROM questions
WHERE deck_id = %(deck_id)s
ORDER BY subtopic_no, q_no;

-- name: insert_attempt
INSERT INTO attempts (user_id, q_id, deck_id, deck_name, subtopic_no, subtopic, correct, page_no, quote, answered_at)
VALUES (%(user_id)s, %(q_id)s, %(deck_id)s, %(deck_name)s, %(subtopic_no)s, %(subtopic)s, %(correct)s,
        %(page_no)s, %(quote)s, %(answered_at)s);

-- name: user_attempts
SELECT q_id, deck_id, deck_name, subtopic_no, subtopic, correct, page_no, quote, answered_at
FROM attempts
WHERE user_id = %(user_id)s
ORDER BY answered_at;

-- name: insert_score
INSERT INTO scores (run_id, deck_id, user_id, player_name, score, accuracy, time_s, won, played_at)
VALUES (%(run_id)s, %(deck_id)s, %(user_id)s, %(player_name)s, %(score)s, %(accuracy)s, %(time_s)s,
        %(won)s, %(played_at)s);

-- name: user_scores
SELECT score FROM scores WHERE user_id = %(user_id)s;

-- name: deck_scores
SELECT run_id, player_name, score, accuracy, time_s, played_at
FROM scores
WHERE deck_id = %(deck_id)s
ORDER BY score DESC, played_at
LIMIT 10;

-- name: save_run
MERGE INTO runs t
USING (SELECT %(run_id)s AS run_id) s
ON t.run_id = s.run_id
WHEN MATCHED THEN UPDATE SET state_json = %(state_json)s, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (run_id, user_id, deck_id, state_json)
  VALUES (%(run_id)s, %(user_id)s, %(deck_id)s, %(state_json)s);

-- name: load_run
SELECT state_json FROM runs WHERE run_id = %(run_id)s;

-- name: embed_questions
-- One vector per question (prompt + correct answer) for the dragon's cosine match.
UPDATE questions
SET embedding = AI_EMBED('snowflake-arctic-embed-l-v2.0',
                         prompt || ' ' || COALESCE(GET(PARSE_JSON(choices_json), answer_index)::STRING, ''))
WHERE deck_id = %(deck_id)s AND embedding IS NULL;

-- name: similar_questions
-- Every question on a ready cartridge, ranked by closeness to the anchor (the latest miss).
SELECT q.deck_id, q.q_no, VECTOR_COSINE_SIMILARITY(q.embedding, a.embedding) AS score
FROM questions a
CROSS JOIN questions q
JOIN decks d ON d.deck_id = q.deck_id
WHERE a.deck_id = %(anchor_deck)s AND a.q_no = %(anchor_q_no)s
  AND a.embedding IS NOT NULL AND q.embedding IS NOT NULL AND d.status = 'ready'
ORDER BY score DESC
LIMIT 60;

-- name: ready_deck_ids
SELECT deck_id FROM decks WHERE status = 'ready';

-- name: hide_deck
-- Taking a cartridge off the shelf keeps its rows (status 'deleted'), so it can be restored.
UPDATE decks SET status = 'deleted' WHERE deck_id = %(deck_id)s AND status = 'ready';

-- name: stats_built
SELECT (SELECT COUNT(*) FROM decks WHERE status = 'ready') AS cartridges,
       (SELECT COUNT(*) FROM slides s JOIN decks d ON d.deck_id = s.deck_id WHERE d.status = 'ready') AS pages,
       (SELECT COUNT(*) FROM chunks c JOIN decks d ON d.deck_id = c.deck_id WHERE d.status = 'ready') AS chunks,
       (SELECT COUNT(c.embedding) FROM chunks c JOIN decks d ON d.deck_id = c.deck_id WHERE d.status = 'ready') AS chunk_vectors,
       (SELECT COUNT(*) FROM questions q JOIN decks d ON d.deck_id = q.deck_id WHERE d.status = 'ready') AS questions,
       (SELECT COUNT(q.embedding) FROM questions q JOIN decks d ON d.deck_id = q.deck_id WHERE d.status = 'ready') AS question_vectors,
       (SELECT COUNT(*) FROM attempts) AS answers_saved,
       (SELECT COUNT(*) FROM scores) AS runs_finished;

-- name: stats_ai_calls
-- The game's Snowflake AI calls in the last 24 hours (live query history). The doubled percent
-- signs are literal LIKE wildcards once the connector formats the statement.
SELECT COUNT_IF(query_text ILIKE '%%AI_PARSE_DOCUMENT%%') AS parse_document,
       COUNT_IF(query_text ILIKE '%%AI_COMPLETE%%') AS complete,
       COUNT_IF(query_text ILIKE '%%AI_EMBED%%') AS embed,
       COUNT_IF(query_text ILIKE '%%VECTOR_COSINE_SIMILARITY%%') AS cosine,
       COUNT(*) AS all_queries
FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(
  END_TIME_RANGE_START => DATEADD('hour', -24, CURRENT_TIMESTAMP()), RESULT_LIMIT => 10000))
WHERE query_text NOT ILIKE '%%QUERY_HISTORY%%';

-- name: stats_cartridges
WITH qs AS (SELECT deck_id, COUNT(*) AS n, COUNT(DISTINCT subtopic_no) AS levels FROM questions GROUP BY deck_id),
     sc AS (SELECT deck_id, COUNT(*) AS plays, MAX(score) AS best FROM scores GROUP BY deck_id),
     an AS (SELECT deck_id, COUNT(*) AS answers, AVG(IFF(correct, 1, 0)) AS accuracy FROM attempts GROUP BY deck_id)
SELECT d.name, d.main_topic, d.slide_count, COALESCE(qs.levels, 0), COALESCE(qs.n, 0),
       COALESCE(sc.plays, 0), sc.best, COALESCE(an.answers, 0), an.accuracy
FROM decks d
LEFT JOIN qs ON qs.deck_id = d.deck_id
LEFT JOIN sc ON sc.deck_id = d.deck_id
LEFT JOIN an ON an.deck_id = d.deck_id
WHERE d.status = 'ready'
ORDER BY d.created_at DESC;
