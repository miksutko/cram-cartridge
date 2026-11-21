-- Cram Cartridge schema. Idempotent: the backend runs this file on its first
-- Snowflake connection, and you can also run it by hand in Snowsight.
-- Needs the CRAM database and CRAM_WH warehouse from 00_smoke_test.sql.

-- AI_PARSE_DOCUMENT needs server-side encryption on the stage.
CREATE STAGE IF NOT EXISTS slides
  DIRECTORY = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

CREATE TABLE IF NOT EXISTS decks (
  deck_id     STRING NOT NULL,
  name        STRING NOT NULL,
  file_name   STRING NOT NULL,
  main_topic  STRING,
  slide_count INT,
  chunk_count INT,
  status      STRING DEFAULT 'processing',
  created_at  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- One row per PDF page, straight from AI_PARSE_DOCUMENT (page_split).
CREATE TABLE IF NOT EXISTS slides (
  deck_id STRING NOT NULL,
  page_no INT NOT NULL,
  content STRING
);

CREATE TABLE IF NOT EXISTS subtopics (
  deck_id     STRING NOT NULL,
  subtopic_no INT NOT NULL,
  name        STRING NOT NULL,
  description STRING,
  embedding   VECTOR(FLOAT, 1024)
);

CREATE TABLE IF NOT EXISTS chunks (
  deck_id     STRING NOT NULL,
  page_no     INT NOT NULL,
  chunk_no    INT NOT NULL,
  text        STRING NOT NULL,
  subtopic_no INT,
  embedding   VECTOR(FLOAT, 1024)
);

CREATE TABLE IF NOT EXISTS questions (
  deck_id      STRING NOT NULL,
  q_no         INT NOT NULL,
  subtopic_no  INT NOT NULL,
  prompt       STRING NOT NULL,
  choices_json STRING NOT NULL,
  answer_index INT NOT NULL,
  explanation  STRING,
  page_no      INT,
  quote        STRING
);

-- Same PDF uploaded again -> reuse the cartridge instead of re-processing it.
ALTER TABLE decks ADD COLUMN IF NOT EXISTS file_hash STRING;

-- Game data that must survive a backend restart.
CREATE TABLE IF NOT EXISTS attempts (
  user_id     STRING NOT NULL,
  q_id        STRING NOT NULL,
  deck_id     STRING NOT NULL,
  deck_name   STRING,
  subtopic_no INT,
  subtopic    STRING,
  correct     BOOLEAN NOT NULL,
  page_no     INT,
  quote       STRING,
  answered_at FLOAT NOT NULL  -- epoch seconds
);

CREATE TABLE IF NOT EXISTS scores (
  run_id      STRING NOT NULL,
  deck_id     STRING NOT NULL,
  user_id     STRING NOT NULL,
  player_name STRING,
  score       INT NOT NULL,
  accuracy    FLOAT,
  time_s      INT,
  won         BOOLEAN,
  played_at   FLOAT NOT NULL  -- epoch seconds
);

-- Latest snapshot of each run (JSON), so a restart does not lose a climb in progress.
CREATE TABLE IF NOT EXISTS runs (
  run_id     STRING NOT NULL,
  user_id    STRING NOT NULL,
  deck_id    STRING NOT NULL,
  state_json STRING NOT NULL,
  updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- One vector per question, so the dragon can pick questions close to your latest miss.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding VECTOR(FLOAT, 1024);
