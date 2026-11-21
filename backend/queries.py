"""Loads the SQL in sql/ so no query text lives in Python."""

import re
from functools import cache
from pathlib import Path

SQL_DIR = Path(__file__).resolve().parent.parent / "sql"


@cache
def _named_queries() -> dict[str, str]:
    text = (SQL_DIR / "02_queries.sql").read_text(encoding="utf-8")
    queries: dict[str, str] = {}
    for block in re.split(r"^-- name:\s*", text, flags=re.MULTILINE)[1:]:
        name, _, body = block.partition("\n")
        lines = [line for line in body.splitlines() if not line.lstrip().startswith("--")]
        queries[name.strip()] = "\n".join(lines).strip().rstrip(";").strip()
    return queries


def q(name: str) -> str:
    return _named_queries()[name]


def schema_sql() -> str:
    return (SQL_DIR / "01_ingest.sql").read_text(encoding="utf-8")
