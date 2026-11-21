-- Run these two first:
CREATE WAREHOUSE IF NOT EXISTS CRAM_WH
  WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS CRAM;
-- Then the AI checks:
SELECT AI_COMPLETE('llama3.1-70b', 'Say OK');
SELECT VECTOR_COSINE_SIMILARITY(
  AI_EMBED('snowflake-arctic-embed-l-v2.0', 'linked list'),
  AI_EMBED('snowflake-arctic-embed-l-v2.0', 'pointer to next node'));
-- Parse test (AI_PARSE_DOCUMENT needs server-side encryption on the stage):
-- CREATE STAGE IF NOT EXISTS slides
--   DIRECTORY = (ENABLE = TRUE) ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');
-- Upload test.pdf to @slides in Snowsight, then:
-- SELECT AI_PARSE_DOCUMENT(TO_FILE('@slides', 'test.pdf'),
--   {'mode': 'LAYOUT', 'page_split': TRUE});
