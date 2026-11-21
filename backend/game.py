"""Run state for the MVP climb. The server owns all state and timing; the UI only displays it.

Runs and answer history live in memory for the alpha (they reset when the server restarts).
"""

import random
import threading
import time
import uuid
from dataclasses import dataclass, field

from . import db
from .decks import Deck, Question, get_deck, other_deck_ids
from .ingest import ai_text, clean_math
from .queries import q

MAX_HP = 5
MVP_LEVELS = 3
MINIBOSS_QUESTIONS = 3
BOSS_QUESTIONS = 8

LEVELS = {
    1: ("Underground", "Minotaur"),
    2: ("Stormy cave", "Kraken"),
    3: ("Dead forest", "Forest beast"),
    4: ("Snowy mountain", "Yeti"),
    5: ("Volcano", "Phoenix"),
}
SUMMIT = ("Cloudy summit", "Dragon")

TAUNTS = {
    "Minotaur": {"miss": ["Lost in the maze of your own notes?", "The labyrinth swallows another student!"],
                 "hit": ["Grrr! A lucky strike.", "My horns... you read that slide."]},
    "Kraken": {"miss": ["Drowning in detail, are we?", "Eight arms, and you still dropped it!"],
               "hit": ["Glub! You knew that one.", "The tide turns... for now."]},
    "Forest beast": {"miss": ["Your knowledge withers like these trees.", "Rotten roots, rotten revision!"],
                     "hit": ["Snarl! Sharp mind.", "The forest remembers that answer."]},
    "Yeti": {"miss": ["Cold. Very cold.", "Your answer froze solid!"],
             "hit": ["Brrr, that one stung.", "You thawed my defences."]},
    "Phoenix": {"miss": ["Burned!", "Your notes go up in flames!"],
                "hit": ["I will rise again... after that one.", "Ashes! You got it."]},
    "Dragon": {"miss": ["I have hoarded that answer for centuries!", "Your revision crumbles at the summit!"],
               "hit": ["The summit trembles!", "A worthy scholar... but not yet a victor."]},
}

QUESTION_REWORD_PROMPT = """Reword this quiz question so it tests the same fact with different wording.
Keep the meaning and the correct answer exactly the same. Reply with only the new question, nothing else.

QUESTION: """


class GameError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


@dataclass
class Node:
    node_id: str
    kind: str  # "miniboss" or "boss"
    level: int | str  # 1..5 or "summit"
    biome: str
    enemy: str
    subtopic_no: int | None
    subtopic: str
    status: str = "locked"  # locked, open, cleared

    def to_dict(self) -> dict:
        return {"node_id": self.node_id, "kind": self.kind, "level": self.level, "biome": self.biome,
                "enemy": self.enemy, "subtopic": self.subtopic, "status": self.status}


@dataclass
class FightQuestion:
    q_id: str
    source: Question
    deck_name: str
    subtopic: str
    prompt: str
    choices: list[str]
    answer: int
    slot: str | None  # "memory", "other_lecture" or None

    def public(self) -> dict:  # never includes the answer
        return {"q_id": self.q_id, "prompt": self.prompt, "choices": self.choices,
                "subtopic": self.subtopic, "deck_name": self.deck_name, "slot": self.slot}


@dataclass
class Fight:
    node: Node
    questions: dict[str, FightQuestion]
    queue: list[str]  # q_ids still to answer; a miss goes back to the end
    enemy_hp: int
    enemy_max_hp: int
    trace: list[dict]


@dataclass
class Run:
    run_id: str
    user_id: str
    deck: Deck
    nodes: list[Node]
    hp: int = MAX_HP
    max_hp: int = MAX_HP
    status: str = "active"  # active, won, lost
    fight: Fight | None = None
    started_at: float = field(default_factory=time.time)
    ended_at: float | None = None
    answered: int = 0
    correct: int = 0
    used: set[str] = field(default_factory=set)
    misses: list[Question] = field(default_factory=list)

    def current_node(self) -> Node | None:
        return next((n for n in self.nodes if n.status == "open"), None)


@dataclass
class Attempt:
    user_id: str
    q_id: str
    deck_id: str
    deck_name: str
    subtopic_no: int
    subtopic: str
    correct: bool
    at: float


_lock = threading.RLock()
_runs: dict[str, Run] = {}
_attempts: list[Attempt] = []
_scores: dict[str, list[int]] = {}


def _run(run_id: str, user_id: str | None = None) -> Run:
    run = _runs.get(run_id)
    if run is None:
        raise GameError(404, "Unknown run")
    if user_id is not None and run.user_id != user_id:
        raise GameError(403, "This run belongs to another player")
    return run


def _map_state(run: Run) -> dict:
    current = run.current_node()
    return {
        "run_id": run.run_id,
        "deck_id": run.deck.deck_id,
        "deck_name": run.deck.name,
        "main_topic": run.deck.main_topic,
        "hp": run.hp,
        "max_hp": run.max_hp,
        "items": [],
        "map": [n.to_dict() for n in run.nodes],
        "current_node_id": current.node_id if current else None,
        "run_status": run.status,
    }


def start_run(user_id: str, deck_id: str) -> dict:
    deck = get_deck(deck_id)
    if deck is None:
        raise GameError(404, "Unknown cartridge")
    subtopics = deck.playable_subtopics()[:MVP_LEVELS]
    if not subtopics:
        raise GameError(422, "This cartridge has no playable levels")
    nodes = [
        Node(f"n{i + 1}", "miniboss", i + 1, LEVELS[i + 1][0], LEVELS[i + 1][1], s.no, s.name)
        for i, s in enumerate(subtopics)
    ]
    nodes.append(Node("summit", "boss", "summit", SUMMIT[0], SUMMIT[1], None, deck.main_topic))
    nodes[0].status = "open"
    run = Run(uuid.uuid4().hex, user_id, deck, nodes)
    with _lock:
        _runs[run.run_id] = run
    return _map_state(run)


def get_map(run_id: str) -> dict:
    with _lock:
        return _map_state(_run(run_id))


def _history(user_id: str) -> dict[str, int]:
    """Misses per question this player has answered (0 = answered, never missed)."""
    misses: dict[str, int] = {}
    for a in _attempts:
        if a.user_id == user_id:
            misses[a.q_id] = misses.get(a.q_id, 0) + (not a.correct)
    return misses


def _ranked(questions: list[Question], history: dict[str, int], used: set[str]) -> list[Question]:
    """Weak points (ever missed, most misses first), then unseen, then known.
    Questions already used this run go last."""
    def rank(x: Question) -> tuple[bool, int, int, float]:
        misses = history.get(x.q_id)
        group = 1 if misses is None else 0 if misses else 2
        return (x.q_id in used, group, -(misses or 0), random.random())
    return sorted(questions, key=rank)


def _fight_question(node: Node, i: int, source: Question, deck: Deck,
                    slot: str | None = None, prompt: str | None = None) -> FightQuestion:
    order = random.sample(range(len(source.choices)), len(source.choices))
    return FightQuestion(
        q_id=f"{node.node_id}.{i}",
        source=source,
        deck_name=deck.name,
        subtopic=deck.subtopic_name(source.subtopic_no),
        prompt=clean_math(prompt or source.prompt),
        choices=[clean_math(source.choices[j]) for j in order],
        answer=order.index(source.answer),
        slot=slot,
    )


def _reword(question: Question, trace: list[dict]) -> str | None:
    if not db.configured():
        return None
    start = time.perf_counter()
    try:
        with db.get_connection() as conn, conn.cursor() as cur:
            cur.execute(q("complete"), {"prompt": QUESTION_REWORD_PROMPT + question.prompt})
            reply = ai_text((cur.fetchone() or [""])[0]).strip().strip('"')
        trace.append({"fn": "AI_COMPLETE (reword)", "ms": round((time.perf_counter() - start) * 1000), "rows": 1})
        return reply[:300] or None
    except Exception as exc:
        trace.append({"fn": "AI_COMPLETE (reword)", "ms": round((time.perf_counter() - start) * 1000),
                      "rows": 0, "error": str(exc)[:200]})
        return None


def _build_fight(run: Run, node: Node) -> Fight:
    history = _history(run.user_id)
    deck = run.deck
    trace: list[dict] = []
    picked: list[FightQuestion] = []

    def add(source: Question, from_deck: Deck, slot: str | None = None, prompt: str | None = None) -> None:
        picked.append(_fight_question(node, len(picked), source, from_deck, slot, prompt))
        run.used.add(source.q_id)

    if node.kind == "miniboss":
        pool = [x for x in deck.questions if x.subtopic_no == node.subtopic_no]
        for source in _ranked(pool, history, run.used)[:MINIBOSS_QUESTIONS]:
            add(source, deck)
    else:
        # Slot 1 (memory): a reworded version of the latest mistake on this cartridge.
        by_id = {x.q_id: x for x in deck.questions}
        latest = next((m for m in reversed(run.misses) if m.q_id in by_id), None)
        if latest is None:
            latest = next((by_id[a.q_id] for a in reversed(_attempts)
                           if a.user_id == run.user_id and not a.correct and a.q_id in by_id), None)
        if latest:
            add(latest, deck, "memory", _reword(latest, trace))
        # Slots 2-3 (other lecture): questions from a different cartridge.
        others = [d for d in (get_deck(i) for i in other_deck_ids(deck.deck_id)) if d and d.questions]
        if others:
            other = random.choice(others)
            for source in _ranked(list(other.questions), history, run.used)[:2]:
                add(source, other, "other_lecture")
        # The rest: the whole topic, one subtopic at a time, weak points first.
        by_subtopic = {}
        for x in _ranked(list(deck.questions), history, run.used):
            if x.q_id not in {p.source.q_id for p in picked}:
                by_subtopic.setdefault(x.subtopic_no, []).append(x)
        while len(picked) < BOSS_QUESTIONS and any(by_subtopic.values()):
            for pool in by_subtopic.values():
                if pool and len(picked) < BOSS_QUESTIONS:
                    add(pool.pop(0), deck)

    questions = {fq.q_id: fq for fq in picked}
    return Fight(node, questions, list(questions), len(picked), len(picked), trace)


def _fight_state(run: Run) -> dict:
    fight = run.fight
    assert fight is not None
    return {
        "kind": fight.node.kind,
        "node_id": fight.node.node_id,
        "level": fight.node.level,
        "biome": fight.node.biome,
        "subtopic": fight.node.subtopic,
        "enemy": {"name": fight.node.enemy, "hp": fight.enemy_hp, "max_hp": fight.enemy_max_hp},
        "questions": [fq.public() for fq in fight.questions.values()],
        "current_q_id": fight.queue[0] if fight.queue else None,
        "player_hp": run.hp,
        "max_hp": run.max_hp,
        "trace": fight.trace,
    }


def enter_node(run_id: str, node_id: str) -> dict:
    with _lock:
        run = _run(run_id)
        if run.status != "active":
            raise GameError(409, "This run is over")
        node = next((n for n in run.nodes if n.node_id == node_id), None)
        if node is None:
            raise GameError(404, "Unknown node")
        if run.fight and run.fight.node.node_id == node_id:
            return _fight_state(run)  # re-entering resumes the same fight
        if node.status != "open":
            raise GameError(409, "That node is not open")
    # Building a boss fight may call Snowflake; do it outside the lock.
    fight = _build_fight(run, node)
    with _lock:
        if run.fight and run.fight.node.node_id == node_id:
            return _fight_state(run)  # a parallel request built it first; keep that one
        if not fight.questions:
            raise GameError(422, "No questions for this node")
        run.fight = fight
        return _fight_state(run)


def _finish(run: Run, status: str) -> dict:
    run.status = status
    run.ended_at = time.time()
    run.fight = None
    seconds = round(run.ended_at - run.started_at)
    score = run.correct * 100 + run.hp * 50 + (500 if status == "won" else 0)
    _scores.setdefault(run.user_id, []).append(score)
    weak: dict[str, int] = {}
    for miss in run.misses:
        name = (get_deck(miss.deck_id) or run.deck).subtopic_name(miss.subtopic_no)
        weak[name] = weak.get(name, 0) + 1
    return {
        "won": status == "won",
        "score": score,
        "best_score": max(_scores[run.user_id]),
        "answered": run.answered,
        "correct": run.correct,
        "accuracy": round(run.correct / run.answered, 2) if run.answered else 0,
        "time_s": seconds,
        "hp_left": run.hp,
        "weak_spots": [{"subtopic": k, "missed": v} for k, v in sorted(weak.items(), key=lambda kv: -kv[1])],
    }


def answer(user_id: str, run_id: str, q_id: str, choice: int | None) -> dict:
    with _lock:
        run = _run(run_id, user_id)
        fight = run.fight
        if run.status != "active" or fight is None:
            raise GameError(409, "No fight in progress")
        if not fight.queue or fight.queue[0] != q_id:
            raise GameError(409, "Answer the current question first")
        if choice is None:
            raise GameError(400, "Typed answers are not in the MVP; send choice")
        fq = fight.questions[q_id]
        if not 0 <= choice < len(fq.choices):
            raise GameError(400, "Choice out of range")

        correct = choice == fq.answer
        run.answered += 1
        _attempts.append(Attempt(user_id, fq.source.q_id, fq.source.deck_id, fq.deck_name,
                                 fq.source.subtopic_no, fq.subtopic, correct, time.time()))
        fight.queue.pop(0)
        taunts = TAUNTS[fight.node.enemy]
        if correct:
            run.correct += 1
            fight.enemy_hp -= 1
            taunt = random.choice(taunts["hit"])
            quote = None
        else:
            run.hp -= 1
            run.misses.append(fq.source)
            fight.queue.append(q_id)  # a missed question comes back at the end of the fight
            taunt = random.choice(taunts["miss"])
            quote = {"text": clean_math(fq.source.quote), "page": fq.source.page, "deck_name": fq.deck_name}

        node_cleared = fight.enemy_hp <= 0
        run_over = None
        if run.hp <= 0:
            run_over = _finish(run, "lost")
        elif node_cleared:
            fight.node.status = "cleared"
            following = next((n for n in run.nodes if n.status == "locked"), None)
            if following:
                following.status = "open"
                run.fight = None
            else:
                run_over = _finish(run, "won")

        return {
            "correct": correct,
            "answer": {"index": fq.answer, "text": fq.choices[fq.answer]},
            "explanation": clean_math(fq.source.explanation),
            "taunt": taunt,
            "quote": quote,
            "player_hp": run.hp,
            "enemy_hp": max(fight.enemy_hp, 0),
            "node_cleared": node_cleared,
            "next_q_id": fight.queue[0] if fight.queue and run.status == "active" and not node_cleared else None,
            "run_status": run.status,
            "run_over": run_over,
        }


def report(user_id: str) -> dict:
    with _lock:
        mine = [a for a in _attempts if a.user_id == user_id]
        scores = _scores.get(user_id, [])
    groups: dict[tuple[str, int], dict] = {}
    for a in mine:
        g = groups.setdefault((a.deck_id, a.subtopic_no), {
            "deck_id": a.deck_id, "deck_name": a.deck_name, "subtopic": a.subtopic, "answered": 0, "correct": 0})
        g["answered"] += 1
        g["correct"] += a.correct
    subtopics = sorted(
        ({**g, "accuracy": round(g["correct"] / g["answered"], 2)} for g in groups.values()),
        key=lambda g: (g["accuracy"], -g["answered"]),
    )
    correct = sum(a.correct for a in mine)
    return {
        "subtopics": subtopics,
        "stats": {
            "answered": len(mine),
            "correct": correct,
            "accuracy": round(correct / len(mine), 2) if mine else 0,
            "runs_finished": len(scores),
            "best_score": max(scores, default=0),
        },
    }
