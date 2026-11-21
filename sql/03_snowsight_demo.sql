-- Cram Cartridge: Snowsight demo worksheet.
-- Paste into a worksheet with database CRAM, schema PUBLIC, warehouse CRAM_WH, and run one at a time.
-- (Not used by the backend.)

-- 1. What Snowflake built from each uploaded PDF.
SELECT d.name, d.main_topic, d.slide_count AS pages, d.chunk_count AS chunks,
       COUNT(DISTINCT q.subtopic_no) AS levels, COUNT(q.q_no) AS questions
FROM decks d
LEFT JOIN questions q ON q.deck_id = d.deck_id
WHERE d.status = 'ready'
GROUP BY 1, 2, 3, 4
ORDER BY 1;

-- 2. The dragon's vector search, live: type any idea a student might get wrong, and Snowflake
--    ranks every question on every cartridge by meaning. Change the text and run it again.
WITH idea AS (
  SELECT AI_EMBED('snowflake-arctic-embed-l-v2.0', 'the contrapositive of an implication') AS v
)
SELECT d.name AS lecture, q.prompt,
       ROUND(VECTOR_COSINE_SIMILARITY(q.embedding, idea.v), 3) AS similarity
FROM idea, questions q
JOIN decks d ON d.deck_id = q.deck_id
WHERE d.status = 'ready' AND q.embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 10;

-- 3. What the game does with your latest miss: anchor on a stored question and pull the
--    closest questions from the OTHER lectures (the dragon's questions 2 and 3).
WITH anchor AS (
  SELECT deck_id, prompt, embedding FROM questions WHERE prompt ILIKE '%tautology%' LIMIT 1
)
SELECT anchor.prompt AS your_miss, d.name AS other_lecture, q.prompt AS dragon_asks,
       ROUND(VECTOR_COSINE_SIMILARITY(q.embedding, anchor.embedding), 3) AS similarity
FROM anchor, questions q
JOIN decks d ON d.deck_id = q.deck_id
WHERE d.status = 'ready' AND q.deck_id <> anchor.deck_id AND q.embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 5;

-- 4. Every question keeps the page and the exact slide sentence it was written from.
SELECT d.name AS lecture, q.prompt, q.page_no, q.quote
FROM questions q
JOIN decks d ON d.deck_id = q.deck_id
WHERE d.status = 'ready'
ORDER BY d.name, q.q_no
LIMIT 15;

-- 5. The game's Snowflake AI calls, newest first (play a question, then run this again).
SELECT start_time, ROUND(total_elapsed_time / 1000, 1) AS seconds, LEFT(query_text, 90) AS query
FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(RESULT_LIMIT => 500))
WHERE query_text ILIKE ANY ('%AI_PARSE_DOCUMENT%', '%AI_COMPLETE%', '%AI_EMBED%', '%VECTOR_COSINE_SIMILARITY%')
  AND query_text NOT ILIKE '%QUERY_HISTORY%'
ORDER BY start_time DESC
LIMIT 20;
