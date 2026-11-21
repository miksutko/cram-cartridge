"""Cartridges (decks) and their questions, from the demo set or from Snowflake."""

import json
import threading
from dataclasses import dataclass

from . import db
from .demo_decks import DEMO_DECKS
from .queries import q

MIN_QUESTIONS_PER_LEVEL = 3


@dataclass(frozen=True)
class Question:
    q_id: str
    deck_id: str
    subtopic_no: int
    prompt: str
    choices: tuple[str, ...]
    answer: int
    explanation: str
    page: int | None
    quote: str


@dataclass(frozen=True)
class Subtopic:
    no: int
    name: str


@dataclass(frozen=True)
class Deck:
    deck_id: str
    name: str
    main_topic: str
    source: str  # "demo" or "snowflake"
    subtopics: tuple[Subtopic, ...]
    questions: tuple[Question, ...]
    slide_count: int
    chunk_count: int

    def subtopic_name(self, no: int) -> str:
        return next((s.name for s in self.subtopics if s.no == no), "Mixed")

    def playable_subtopics(self) -> list[Subtopic]:
        return [
            s for s in self.subtopics
            if sum(1 for x in self.questions if x.subtopic_no == s.no) >= MIN_QUESTIONS_PER_LEVEL
        ]

    def summary(self) -> dict:
        return {
            "deck_id": self.deck_id,
            "name": self.name,
            "main_topic": self.main_topic,
            "source": self.source,
            "subtopics": [s.name for s in self.playable_subtopics()],
            "slides": self.slide_count,
        }


def _demo_deck(raw: dict) -> Deck:
    questions = tuple(
        Question(
            q_id=f"{raw['deck_id']}:{i}",
            deck_id=raw["deck_id"],
            subtopic_no=sub,
            prompt=prompt,
            choices=tuple(choices),
            answer=0,
            explanation=explanation,
            page=page,
            quote=quote,
        )
        for i, (sub, page, prompt, choices, explanation, quote) in enumerate(raw["questions"])
    )
    return Deck(
        deck_id=raw["deck_id"],
        name=raw["name"],
        main_topic=raw["main_topic"],
        source="demo",
        subtopics=tuple(Subtopic(i + 1, name) for i, name in enumerate(raw["subtopics"])),
        questions=questions,
        slide_count=len(raw["slides"]),
        chunk_count=0,
    )


_DEMO = {raw["deck_id"]: _demo_deck(raw) for raw in DEMO_DECKS}
_cache: dict[str, Deck] = {}
_cache_lock = threading.Lock()


def list_decks() -> tuple[list[dict], str | None]:
    """All playable cartridges, plus the Snowflake error if Snowflake could not be read."""
    decks = [d.summary() for d in _DEMO.values()]
    if not db.configured():
        return decks, "Snowflake is not configured (.env)"
    try:
        with db.get_connection() as conn:
            db.ensure_schema(conn)
            with conn.cursor() as cur:
                cur.execute(q("list_decks"))
                rows = cur.fetchall()
    except Exception as exc:  # the shelf still works with the demo decks
        return decks, str(exc)
    for deck_id, name, main_topic, slides, _chunks, subtopic_count in rows:
        if subtopic_count:
            decks.append({
                "deck_id": deck_id, "name": name, "main_topic": main_topic or name,
                "source": "snowflake", "subtopics": None, "slides": slides or 0,
            })
    return decks, None


def get_deck(deck_id: str) -> Deck | None:
    if deck_id in _DEMO:
        return _DEMO[deck_id]
    with _cache_lock:
        if deck_id in _cache:
            return _cache[deck_id]
    if not db.configured():
        return None
    deck = _load_snowflake_deck(deck_id)
    if deck:
        with _cache_lock:
            _cache[deck_id] = deck
    return deck


def other_deck_ids(deck_id: str) -> list[str]:
    ids = [d_id for d_id in _DEMO if d_id != deck_id]
    with _cache_lock:
        ids += [d_id for d_id in _cache if d_id != deck_id]
    return ids


def _load_snowflake_deck(deck_id: str) -> Deck | None:
    params = {"deck_id": deck_id}
    with db.get_connection() as conn, conn.cursor() as cur:
        cur.execute(q("deck_info"), params)
        info = cur.fetchone()
        if not info:
            return None
        cur.execute(q("deck_subtopics"), params)
        subtopics = tuple(Subtopic(int(no), name) for no, name in cur.fetchall())
        cur.execute(q("deck_questions"), params)
        rows = cur.fetchall()
    name, main_topic, slides, chunks = info
    questions = tuple(
        Question(
            q_id=f"{deck_id}:{q_no}",
            deck_id=deck_id,
            subtopic_no=int(sub),
            prompt=prompt,
            choices=tuple(json.loads(choices_json)),
            answer=int(answer),
            explanation=explanation or "",
            page=int(page) if page is not None else None,
            quote=quote or "",
        )
        for q_no, sub, prompt, choices_json, answer, explanation, page, quote in rows
    )
    return Deck(deck_id, name, main_topic or name, "snowflake", subtopics, questions, slides or 0, chunks or 0)


def remember(deck: Deck) -> None:
    with _cache_lock:
        _cache[deck.deck_id] = deck
