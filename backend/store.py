"""Durable game data in Snowflake: answer attempts, scores and run snapshots.

Writes go through one background thread (in order), so answering a question never
waits on Snowflake. Reads only happen on a cache miss, e.g. after a server restart.
Without Snowflake configured, everything stays in memory and this module does nothing.
"""

import logging
import queue
import threading
import time
from typing import Any

from . import db
from .queries import q

logger = logging.getLogger(__name__)

_writes: "queue.Queue[tuple[str, dict[str, Any]]]" = queue.Queue()
_worker: threading.Thread | None = None
_worker_lock = threading.Lock()


def write(query_name: str, params: dict[str, Any]) -> None:
    """Queue a write; returns immediately."""
    if not db.configured():
        return
    global _worker
    with _worker_lock:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_drain, name="snowflake-writer", daemon=True)
            _worker.start()
    _writes.put((query_name, params))


def _drain() -> None:
    conn = None
    while True:
        name, params = _writes.get()
        for attempt in (1, 2):
            try:
                if conn is None:
                    conn = db.get_connection()
                    db.ensure_schema(conn)
                with conn.cursor() as cur:
                    cur.execute(q(name), params)
                break
            except Exception as exc:  # reconnect once, then drop the write
                logger.warning("Snowflake write %s failed (try %d): %s", name, attempt, exc)
                try:
                    if conn is not None:
                        conn.close()
                except Exception:
                    pass
                conn = None
        _writes.task_done()


def flush(timeout: float = 15.0) -> bool:
    """Wait (up to timeout seconds) for queued writes to reach Snowflake. True if all were sent."""
    deadline = time.monotonic() + timeout
    while _writes.unfinished_tasks and time.monotonic() < deadline:
        time.sleep(0.05)
    return not _writes.unfinished_tasks


def read(query_name: str, params: dict[str, Any]) -> list[tuple]:
    """Run a read query; returns [] when Snowflake is not configured or fails."""
    if not db.configured():
        return []
    try:
        with db.get_connection() as conn:
            db.ensure_schema(conn)
            with conn.cursor() as cur:
                cur.execute(q(query_name), params)
                return list(cur.fetchall())
    except Exception as exc:
        logger.warning("Snowflake read %s failed: %s", query_name, exc)
        return []
