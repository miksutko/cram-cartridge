"""GET /api/stats: the player's history plus what Snowflake has built, for the STATS screen."""

import threading
import time

from . import game, store

_TTL_S = 20
_cache: dict = {"at": 0.0, "data": None}
_lock = threading.Lock()


_refreshing = threading.Event()


def _snowflake_part() -> dict:
    """Served from memory; when older than the TTL, refreshed in the background (the query
    history read takes a few seconds), so the STATS screen opens instantly."""
    with _lock:
        data, age = _cache["data"], time.time() - _cache["at"]
    if data is not None:
        if age >= _TTL_S and not _refreshing.is_set():
            _refreshing.set()
            threading.Thread(target=_refresh_quietly, name="stats-refresh", daemon=True).start()
        return data
    return refresh()


def _refresh_quietly() -> None:
    try:
        refresh()
    finally:
        _refreshing.clear()


def refresh() -> dict:
    built = store.read("stats_built", {})
    calls = store.read("stats_ai_calls", {})
    decks = store.read("stats_cartridges", {})
    b = built[0] if built else (0,) * 8
    c = calls[0] if calls else (0,) * 5
    data = {
        "built": {
            "cartridges": b[0], "pages": b[1], "chunks": b[2], "chunk_vectors": b[3],
            "questions": b[4], "question_vectors": b[5], "answers_saved": b[6], "runs_finished": b[7],
        },
        "ai_calls_24h": {"parse_document": c[0], "complete": c[1], "embed": c[2], "cosine": c[3], "all_queries": c[4]},
        "cartridges": [
            {"name": name, "main_topic": topic, "slides": slides or 0, "levels": levels, "questions": questions,
             "plays": plays, "best_score": best, "answers": answers,
             "accuracy": round(float(acc), 2) if acc is not None else None}
            for name, topic, slides, levels, questions, plays, best, answers, acc in decks
        ],
        "connected": bool(built),
    }
    with _lock:
        _cache.update(at=time.time(), data=data)
    return data


def stats(user_id: str) -> dict:
    return {"you": game.report(user_id), **_snowflake_part()}
