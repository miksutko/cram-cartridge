import os
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import snowflake.connector
from dotenv import load_dotenv

from .queries import schema_sql

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_REQUIRED = ("SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD")
_OPTIONAL = {
    "role": "SNOWFLAKE_ROLE",
    "warehouse": "SNOWFLAKE_WAREHOUSE",
    "database": "SNOWFLAKE_DATABASE",
    "schema": "SNOWFLAKE_SCHEMA",
}

_schema_lock = threading.Lock()
_schema_ready = False
_pool: list[snowflake.connector.SnowflakeConnection] = []
_pool_lock = threading.Lock()


def configured() -> bool:
    return all(os.getenv(name) for name in _REQUIRED)


def get_connection() -> snowflake.connector.SnowflakeConnection:
    missing = [name for name in _REQUIRED if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"Missing in .env: {', '.join(missing)}")

    optional = {arg: os.environ[var] for arg, var in _OPTIONAL.items() if os.getenv(var)}
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        login_timeout=20,
        # Fail loudly if the configured warehouse/database/schema does not exist.
        validate_default_parameters=True,
        **optional,
    )


@contextmanager
def pooled() -> Iterator[snowflake.connector.SnowflakeConnection]:
    """An open connection reused across game requests (a fresh login costs 1-2 s).
    A connection that raised is closed instead of going back to the pool."""
    with _pool_lock:
        conn = _pool.pop() if _pool else None
    if conn is None or conn.is_closed():
        conn = get_connection()
    healthy = False
    try:
        yield conn
        healthy = True
    finally:
        if healthy and not conn.is_closed():
            with _pool_lock:
                if len(_pool) < 4:
                    _pool.append(conn)
                    conn = None
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def ensure_schema(conn: snowflake.connector.SnowflakeConnection) -> None:
    """Run sql/01_ingest.sql once per process (every statement is IF NOT EXISTS)."""
    global _schema_ready
    if _schema_ready:
        return
    with _schema_lock:
        if not _schema_ready:
            for cur in conn.execute_string(schema_sql()):
                cur.close()
            _schema_ready = True


def ping() -> str:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT CURRENT_VERSION()")
        row = cur.fetchone()
        return str(row[0]) if row else ""
