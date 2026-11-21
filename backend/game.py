"""Run state for the climb. The server owns all state and timing; the UI only displays it.

Each level (one per subtopic, up to 5): a regular enemy (2 questions), then the mini boss
(3 questions); a Blitz round (timed) in level 2 and a treasure chest after levels 1 and 3.
Then the dragon at the summit (8 questions).

Runs, answers and scores are served from memory and written to Snowflake in the background
(backend/store.py). After a restart they are read back from Snowflake on first use.
"""

import json
import random
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field

from . import db, store
from .decks import Deck, Question, get_deck, list_decks
from .ingest import ai_text, clean_math
from .queries import q

MAX_HP = 7
MAX_LEVELS = 5
ENEMY_QUESTIONS = 2
MINIBOSS_QUESTIONS = 3
BLITZ_QUESTIONS = 4
BOSS_QUESTIONS = 8

# The judge's climb (name JUDGE, or judge: true): every stop with 1 question, a 3-question
# dragon, the right answer marked with a dot, and nothing saved.
JUDGE_NAME = "JUDGE"
JUDGE_MARK = " \u2022"
JUDGE_COUNTS = {"enemy": 1, "miniboss": 1, "blitz": 1, "boss": 3}

BLITZ_LIMIT_MS = 10_000
BLITZ_GRACE_S = 2.0  # a late answer within this is still accepted (network, animation)
AFTER_HIT_S = 1.2  # the client's result screen before the next Blitz question
AFTER_MISS_S = 8.0  # the client shows the slide quote after a miss

# level -> (biome, mini boss, regular enemy)
LEVELS = {
    1: ("Underground", "Minotaur", "Torchmite"),
    2: ("Stormy cave", "Hydra", "Brinecrab"),
    3: ("Dead forest", "Thornhart", "Hollow Crow"),
    4: ("Snowy mountain", "Yeti", "Frost Imp"),
    5: ("Volcano", "Phoenix", "Cinder Slug"),
}
SUMMIT = ("Cloudy summit", "Retep")
TREASURE_AFTER = {1, 3}
BLITZ_IN = {2}

ITEMS = {
    "split_rune": ("Split Rune", "Removes two wrong answers"),
    "sages_whisper": ("Sage's Whisper", "A hint from the slide"),
    "heartstone": ("Heartstone", "One extra heart"),
    "aegis_ward": ("Aegis Ward", "Blocks the next hit"),
}

TAUNTS = {
    "Minotaur": {"miss": ["Lost in the maze of your own notes?", "The labyrinth swallows another student!"],
                 "hit": ["Grrr! A lucky strike.", "My horns... you read that slide."]},
    "Hydra": {"miss": ["Cut one question, two more grow back!", "Drowning in detail, are we?"],
              "hit": ["Hiss! You knew that one.", "The tide turns... for now."]},
    "Thornhart": {"miss": ["Your knowledge withers like these trees.", "Rotten roots, rotten revision!"],
                  "hit": ["Snarl! Sharp mind.", "The forest remembers that answer."]},
    "Yeti": {"miss": ["Cold. Very cold.", "Your answer froze solid!"],
             "hit": ["Brrr, that one stung.", "You thawed my defences."]},
    "Phoenix": {"miss": ["Burned!", "Your notes go up in flames!"],
                "hit": ["I will rise again... after that one.", "Ashes! You got it."]},
    "Retep": {"miss": ["I have hoarded that answer for centuries!", "Your revision crumbles at the summit!"],
              "hit": ["The summit trembles!", "A worthy scholar... but not yet a victor."]},
}
GENERIC_TAUNTS = {"miss": ["Too slow, scholar!", "That one slipped right past you!"],
                  "hit": ["Ow! You know your slides.", "Eek! Right on target."]}

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
    kind: str  # "enemy", "miniboss", "blitz", "treasure" or "boss"
    level: int | str  # 1..5 or "summit"
    biome: str
    enemy: str
    subtopic_no: int | None
    subtopic: str
    status: str = "locked"  # locked, open, cleared

    def to_dict(self) -> dict:
        return {"node_id": self.node_id, "kind": self.kind, "level": self.level, "biome": self.biome,
                "enemy": self.enemy or None, "subtopic": self.subtopic, "status": self.status}


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
    similarity: float | None = None  # cosine score vs the latest miss (other_lecture questions)
    time_limit_ms: int | None = None  # Blitz questions only

    def public(self) -> dict:  # never includes the answer
        data = {"q_id": self.q_id, "prompt": self.prompt, "choices": self.choices,
                "subtopic": self.subtopic, "deck_name": self.deck_name, "slot": self.slot}
        if self.similarity is not None:
            data["similarity"] = self.similarity
        if self.time_limit_ms is not None:
            data["time_limit_ms"] = self.time_limit_ms
        return data


@dataclass
class Fight:
    node: Node
    questions: dict[str, FightQuestion]
    queue: list[str]  # q_ids still to answer; a miss goes back to the end
    enemy_hp: int
    enemy_max_hp: int
    trace: list[dict]
    deadline: float | None = None  # Blitz: when time runs out on the current question (epoch s)


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
    player_name: str = "PLAYER"
    last_answer: tuple[str, dict] | None = None  # (q_id, response) to replay a duplicate submit
    items: dict[str, int] = field(default_factory=dict)  # item_id -> count
    shield: bool = False  # Aegis Ward: the next miss costs no HP
    judge: bool = False  # the judge's climb: short, answers marked, nothing saved

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
    page: int | None = None
    quote: str = ""


_lock = threading.RLock()
_runs: dict[str, Run] = {}
_attempts: list[Attempt] = []
_scores: dict[str, list[int]] = {}  # user_id -> scores
_recent_scores: dict[str, list[dict]] = {}  # deck_id -> rows not yet confirmed in Snowflake
_loaded_users: set[str] = set()


def _question(q_id: str) -> Question | None:
    deck = get_deck(q_id.rsplit(":", 1)[0])
    return next((x for x in deck.questions if x.q_id == q_id), None) if deck else None


def _ensure_user(user_id: str) -> None:
    """Load this player's history from Snowflake once per process (before any new answer)."""
    with _lock:
        if user_id in _loaded_users:
            return
    attempts = store.read("user_attempts", {"user_id": user_id})
    scores = store.read("user_scores", {"user_id": user_id})
    with _lock:
        if user_id in _loaded_users:
            return
        _loaded_users.add(user_id)
        _attempts[:0] = [
            Attempt(user_id, q_id, deck_id, deck_name or "", int(sub or 0), subtopic or "", bool(correct),
                    float(at), int(page) if page is not None else None, quote or "")
            for q_id, deck_id, deck_name, sub, subtopic, correct, page, quote, at in attempts
        ]
        _scores.setdefault(user_id, [])[:0] = [int(row[0]) for row in scores]


def _snapshot(run: Run) -> str:
    fight = run.fight
    return json.dumps({
        "run_id": run.run_id, "user_id": run.user_id, "deck_id": run.deck.deck_id,
        "player_name": run.player_name, "nodes": [asdict(n) for n in run.nodes], "hp": run.hp,
        "max_hp": run.max_hp, "status": run.status, "started_at": run.started_at, "ended_at": run.ended_at,
        "answered": run.answered, "correct": run.correct, "used": sorted(run.used),
        "misses": [m.q_id for m in run.misses], "items": run.items, "shield": run.shield,
        "fight": None if fight is None else {
            "node_id": fight.node.node_id, "queue": fight.queue, "enemy_hp": fight.enemy_hp,
            "enemy_max_hp": fight.enemy_max_hp, "trace": fight.trace, "deadline": fight.deadline,
            "questions": [{"q_id": fq.q_id, "source": fq.source.q_id, "deck_name": fq.deck_name,
                           "subtopic": fq.subtopic, "prompt": fq.prompt, "choices": fq.choices,
                           "answer": fq.answer, "slot": fq.slot, "similarity": fq.similarity,
                           "time_limit_ms": fq.time_limit_ms}
                          for fq in fight.questions.values()],
        },
    })


def _restore(state: dict) -> Run | None:
    deck = get_deck(state["deck_id"])
    if deck is None:
        return None
    nodes = [Node(**n) for n in state["nodes"]]
    run = Run(
        state["run_id"], state["user_id"], deck, nodes, hp=state["hp"], max_hp=state["max_hp"],
        status=state["status"], started_at=state["started_at"], ended_at=state["ended_at"],
        answered=state["answered"], correct=state["correct"], used=set(state["used"]),
        misses=[m for m in (_question(x) for x in state["misses"]) if m],
        player_name=state.get("player_name") or "PLAYER",
        items=dict(state.get("items") or {}), shield=bool(state.get("shield")),
    )
    saved = state.get("fight")
    node = next((n for n in nodes if saved and n.node_id == saved["node_id"]), None)
    if saved and node:
        questions = {}
        for item in saved["questions"]:
            source = _question(item["source"])
            if source is None:
                return run  # the fight cannot be rebuilt; re-entering the node starts a fresh one
            questions[item["q_id"]] = FightQuestion(item["q_id"], source, item["deck_name"], item["subtopic"],
                                                    item["prompt"], item["choices"], item["answer"], item["slot"],
                                                    item.get("similarity"), item.get("time_limit_ms"))
        run.fight = Fight(node, questions, saved["queue"], saved["enemy_hp"], saved["enemy_max_hp"], saved["trace"],
                          saved.get("deadline"))
    return run


def _save(run: Run) -> None:
    if run.judge:
        return  # judge runs leave no trace
    store.write("save_run", {"run_id": run.run_id, "user_id": run.user_id, "deck_id": run.deck.deck_id,
                             "state_json": _snapshot(run)})


def _ensure_run(run_id: str) -> None:
    """After a restart, bring a run back from its Snowflake snapshot."""
    with _lock:
        if run_id in _runs:
            return
    rows = store.read("load_run", {"run_id": run_id})
    run = _restore(json.loads(rows[0][0])) if rows else None
    if run:
        with _lock:
            _runs.setdefault(run_id, run)


def _run(run_id: str, user_id: str | None = None) -> Run:
    run = _runs.get(run_id)
    if run is None:
        raise GameError(404, "Unknown run")
    if user_id is not None and run.user_id != user_id:
        raise GameError(403, "This run belongs to another player")
    return run


def _items(run: Run) -> list[dict]:
    return [{"item_id": k, "name": ITEMS.get(k, (k, ""))[0], "count": n} for k, n in run.items.items() if n > 0]


def _map_state(run: Run) -> dict:
    current = run.current_node()
    return {
        "run_id": run.run_id,
        "deck_id": run.deck.deck_id,
        "deck_name": run.deck.name,
        "main_topic": run.deck.main_topic,
        "hp": run.hp,
        "max_hp": run.max_hp,
        "items": _items(run),
        "map": [n.to_dict() for n in run.nodes],
        "current_node_id": current.node_id if current else None,
        "run_status": run.status,
        "player_name": run.player_name,
        "judge": run.judge,
    }


def start_run(user_id: str, deck_id: str, player_name: str | None = None, judge: bool = False) -> dict:
    _ensure_user(user_id)
    deck = get_deck(deck_id)
    if deck is None:
        raise GameError(404, "Unknown cartridge")
    subtopics = deck.playable_subtopics()[:MAX_LEVELS]
    if not subtopics:
        raise GameError(422, "This cartridge has no playable levels")
    nodes: list[Node] = []
    for level, s in enumerate(subtopics, start=1):
        biome, boss, minion = LEVELS[level]
        nodes.append(Node(f"l{level}-enemy", "enemy", level, biome, minion, s.no, s.name))
        if level in BLITZ_IN:
            nodes.append(Node(f"l{level}-blitz", "blitz", level, biome, minion, s.no, s.name))
        nodes.append(Node(f"l{level}-boss", "miniboss", level, biome, boss, s.no, s.name))
        if level in TREASURE_AFTER:
            nodes.append(Node(f"l{level}-chest", "treasure", level, biome, "", s.no, s.name))
    nodes.append(Node("summit", "boss", "summit", SUMMIT[0], SUMMIT[1], None, deck.main_topic))
    nodes[0].status = "open"
    name = (player_name or "").strip()[:20] or "PLAYER"
    judge = judge or name.upper() == JUDGE_NAME
    run = Run(uuid.uuid4().hex, user_id, deck, nodes, player_name=name, judge=judge)
    with _lock:
        _runs[run.run_id] = run
    _save(run)
    return _map_state(run)


def get_map(run_id: str) -> dict:
    _ensure_run(run_id)
    with _lock:
        return _map_state(_run(run_id))


def _history(user_id: str) -> dict[str, int]:
    """Misses per question this player has answered (0 = answered, never missed)."""
    misses: dict[str, int] = {}
    for a in _attempts:
        if a.user_id == user_id:
            misses[a.q_id] = misses.get(a.q_id, 0) + (not a.correct)
    return misses


def _ranked(questions: list[Question], history: dict[str, int], used: set[str],
            near: dict[str, float] | None = None) -> list[Question]:
    """Weak points (ever missed, most misses first), then unseen, then known; within a group,
    the questions closest to the latest miss come first. Questions used this run go last."""
    near = near or {}

    def rank(x: Question) -> tuple[bool, int, int, float, float]:
        misses = history.get(x.q_id)
        group = 1 if misses is None else 0 if misses else 2
        return (x.q_id in used, group, -(misses or 0), -near.get(x.q_id, 0.0), random.random())
    return sorted(questions, key=rank)


def _fight_question(node: Node, i: int, source: Question, deck: Deck, slot: str | None = None,
                    prompt: str | None = None, similarity: float | None = None) -> FightQuestion:
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
        similarity=similarity,
    )


def _reword(question: Question, trace: list[dict]) -> str | None:
    if not db.configured():
        return None
    start = time.perf_counter()
    try:
        with db.pooled() as conn, conn.cursor() as cur:
            cur.execute(q("complete"), {"prompt": QUESTION_REWORD_PROMPT + question.prompt})
            reply = ai_text((cur.fetchone() or [""])[0]).strip().strip('"')
        trace.append({"fn": "AI_COMPLETE (reword)", "ms": round((time.perf_counter() - start) * 1000), "rows": 1})
        return reply[:300] or None
    except Exception as exc:
        trace.append({"fn": "AI_COMPLETE (reword)", "ms": round((time.perf_counter() - start) * 1000),
                      "rows": 0, "error": str(exc)[:200]})
        return None


def _cosine_matches(deck: Deck, anchor: Question, trace: list[dict]) -> tuple[list[tuple[Deck, Question, float]], dict[str, float]]:
    """VECTOR_COSINE_SIMILARITY in Snowflake between the anchor (the latest miss) and every question.
    Returns the 2 closest questions from other lectures, and this cartridge's scores by q_id."""
    if not db.configured() or anchor.deck_id.startswith("demo-"):
        return [], {}
    anchor_deck, q_no = anchor.q_id.rsplit(":", 1)
    start = time.perf_counter()
    rows = store.read("similar_questions", {"anchor_deck": anchor_deck, "anchor_q_no": int(q_no)})
    near = {f"{d}:{n}": float(score) for d, n, score in rows if d == deck.deck_id}
    picked: list[tuple[Deck, Question, float]] = []
    seen = {anchor.prompt.strip().lower()}
    for deck_id, other_no, score in rows:
        if deck_id == deck.deck_id or float(score) >= 0.98:  # same lecture, or a re-uploaded copy
            continue
        other = get_deck(deck_id)
        source = next((x for x in other.questions if x.q_id == f"{deck_id}:{other_no}"), None) if other else None
        if source is None or source.prompt.strip().lower() in seen:
            continue
        seen.add(source.prompt.strip().lower())
        picked.append((other, source, round(float(score), 3)))
        if len(picked) == 2:
            break
    trace.append({
        "fn": "VECTOR_COSINE_SIMILARITY (dragon)",
        "ms": round((time.perf_counter() - start) * 1000),
        "rows": len(rows),
        "detail": {
            "anchor": clean_math(anchor.prompt),
            "matches": [{"deck_name": o.name, "prompt": clean_math(x.prompt), "score": sc} for o, x, sc in picked],
        },
    })
    return picked, near


def _other_deck(deck: Deck) -> Deck | None:
    """A different lecture for the dragon's slots 2-3: a real upload for a real upload,
    the other demo for a demo; anything else only as a fallback."""
    summaries, _ = list_decks()
    others = [d for d in summaries if d["deck_id"] != deck.deck_id]
    same = [d["deck_id"] for d in others if d["source"] == deck.source]
    rest = [d["deck_id"] for d in others if d["source"] != deck.source]
    random.shuffle(same)
    random.shuffle(rest)
    for deck_id in same + rest:
        other = get_deck(deck_id)
        if other and other.questions:
            return other
    return None


def _build_fight(run: Run, node: Node) -> Fight:
    history = _history(run.user_id)
    deck = run.deck
    trace: list[dict] = []
    picked: list[FightQuestion] = []

    def add(source: Question, from_deck: Deck, slot: str | None = None, prompt: str | None = None,
            similarity: float | None = None) -> None:
        picked.append(_fight_question(node, len(picked), source, from_deck, slot, prompt, similarity))
        run.used.add(source.q_id)

    if node.kind in ("enemy", "miniboss"):
        count = ENEMY_QUESTIONS if node.kind == "enemy" else MINIBOSS_QUESTIONS
        if run.judge:
            count = JUDGE_COUNTS[node.kind]
        pool = [x for x in deck.questions if x.subtopic_no == node.subtopic_no]
        for source in _ranked(pool, history, run.used)[:count]:
            add(source, deck)
    elif node.kind == "blitz":
        # Everything climbed so far, weak points first, against the clock.
        reached = {n.subtopic_no for n in run.nodes if isinstance(n.level, int) and n.level <= node.level}
        pool = [x for x in deck.questions if x.subtopic_no in reached]
        for source in _ranked(pool, history, run.used)[:JUDGE_COUNTS["blitz"] if run.judge else BLITZ_QUESTIONS]:
            add(source, deck)
        for fq in picked:
            fq.time_limit_ms = BLITZ_LIMIT_MS
    else:
        # Slot 1 (memory): a reworded version of the latest mistake on this cartridge.
        by_id = {x.q_id: x for x in deck.questions}
        latest = next((m for m in reversed(run.misses) if m.q_id in by_id), None)
        if latest is None:
            latest = next((by_id[a.q_id] for a in reversed(_attempts)
                           if a.user_id == run.user_id and not a.correct and a.q_id in by_id), None)
        # Slots 2-3 (other lecture): the questions in other lectures closest to the latest miss
        # (or, with no miss yet, to this cartridge's weakest question), by cosine similarity.
        # The reword and the cosine match are separate Snowflake calls, so run them together.
        anchor = latest or next(iter(_ranked(list(deck.questions), history, set())), None)
        reword_trace: list[dict] = []
        cosine_trace: list[dict] = []
        with ThreadPoolExecutor(max_workers=2) as pool:
            reworded = pool.submit(_reword, latest, reword_trace) if latest else None
            cosine = pool.submit(_cosine_matches, deck, anchor, cosine_trace) if anchor else None
            reworded_prompt = reworded.result() if reworded else None
            matches, near = cosine.result() if cosine else ([], {})
        trace.extend(reword_trace + cosine_trace)
        if latest:
            add(latest, deck, "memory", reworded_prompt)
        for other, source, score in matches:
            add(source, other, "other_lecture", similarity=score)
        if not matches:  # demo cartridges, or Snowflake unavailable
            other = _other_deck(deck)
            if other:
                for source in _ranked(list(other.questions), history, run.used)[:2]:
                    add(source, other, "other_lecture")
        # The rest: the whole topic, one subtopic at a time, weak points (then near the miss) first.
        by_subtopic = {}
        for x in _ranked(list(deck.questions), history, run.used, near):
            if x.q_id not in {p.source.q_id for p in picked}:
                by_subtopic.setdefault(x.subtopic_no, []).append(x)
        boss_count = JUDGE_COUNTS["boss"] if run.judge else BOSS_QUESTIONS
        while len(picked) < boss_count and any(by_subtopic.values()):
            for pool in by_subtopic.values():
                if pool and len(picked) < boss_count:
                    add(pool.pop(0), deck)

    if run.judge:  # mark the right answer so the judge can move fast (or miss on purpose)
        picked = picked[:JUDGE_COUNTS.get(node.kind, len(picked))]
        for fq in picked:
            fq.choices = [c + JUDGE_MARK if i == fq.answer else c for i, c in enumerate(fq.choices)]
    questions = {fq.q_id: fq for fq in picked}
    deadline = time.time() + BLITZ_LIMIT_MS / 1000 if node.kind == "blitz" else None
    return Fight(node, questions, list(questions), len(picked), len(picked), trace, deadline)


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
        "time_left_ms": _time_left(fight),
    }


def _time_left(fight: Fight) -> int | None:
    if fight.deadline is None:
        return None
    return max(0, min(BLITZ_LIMIT_MS, round((fight.deadline - time.time()) * 1000)))


def _treasure(run: Run, node: Node) -> dict:
    """The chest's three items; the same every time this run opens this chest."""
    rng = random.Random(f"{run.run_id}:{node.node_id}")
    offer = rng.sample(sorted(ITEMS), 3)
    return {
        "kind": "treasure",
        "node_id": node.node_id,
        "level": node.level,
        "choices": [{"choice_id": f"{node.node_id}.{i}", "item_id": item, "name": ITEMS[item][0],
                     "desc": ITEMS[item][1]} for i, item in enumerate(offer)],
        "trace": [],
    }


def _open_next(run: Run, node: Node) -> bool:
    """Clear a node and open the next one. False when there is none (the run is won)."""
    node.status = "cleared"
    following = next((n for n in run.nodes if n.status == "locked"), None)
    if following:
        following.status = "open"
        return True
    return False


def enter_node(run_id: str, node_id: str) -> dict:
    _ensure_run(run_id)
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
        if node.kind == "treasure":
            return _treasure(run, node)
    # Building a boss fight may call Snowflake; do it outside the lock.
    fight = _build_fight(run, node)
    with _lock:
        if run.fight and run.fight.node.node_id == node_id:
            return _fight_state(run)  # a parallel request built it first; keep that one
        if not fight.questions:
            raise GameError(422, "No questions for this node")
        run.fight = fight
        _save(run)
        return _fight_state(run)


def _finish(run: Run, status: str) -> dict:
    run.status = status
    run.ended_at = time.time()
    run.fight = None
    seconds = round(run.ended_at - run.started_at)
    score = run.correct * 100 + run.hp * 50 + (500 if status == "won" else 0)
    accuracy = round(run.correct / run.answered, 2) if run.answered else 0
    if not run.judge:
        _scores.setdefault(run.user_id, []).append(score)
        row = {"run_id": run.run_id, "deck_id": run.deck.deck_id, "user_id": run.user_id,
               "player_name": run.player_name, "score": score, "accuracy": accuracy, "time_s": seconds,
               "won": status == "won", "played_at": run.ended_at}
        _recent_scores.setdefault(run.deck.deck_id, []).append(row)
        store.write("insert_score", row)
    weak: dict[str, int] = {}
    for miss in run.misses:
        name = (get_deck(miss.deck_id) or run.deck).subtopic_name(miss.subtopic_no)
        weak[name] = weak.get(name, 0) + 1
    return {
        "won": status == "won",
        "score": score,
        "best_score": max(_scores.get(run.user_id, []) + [score]),
        "answered": run.answered,
        "correct": run.correct,
        "accuracy": accuracy,
        "time_s": seconds,
        "hp_left": run.hp,
        "weak_spots": [{"subtopic": k, "missed": v} for k, v in sorted(weak.items(), key=lambda kv: -kv[1])],
        "bosses_beaten": [n.enemy for n in run.nodes if n.status == "cleared" and n.kind in ("miniboss", "boss")],
    }


def answer(user_id: str, run_id: str, q_id: str, choice: int | None) -> dict:
    _ensure_user(user_id)
    _ensure_run(run_id)
    with _lock:
        run = _run(run_id, user_id)
        fight = run.fight
        if run.last_answer and run.last_answer[0] == q_id and (fight is None or not fight.queue
                                                                or fight.queue[0] != q_id):
            return run.last_answer[1]  # the same answer sent twice (double click, UI retry): first one counts
        if run.status != "active" or fight is None:
            raise GameError(409, "No fight in progress")
        if not fight.queue or fight.queue[0] != q_id:
            raise GameError(409, "Answer the current question first")
        fq = fight.questions[q_id]
        blitz = fight.node.kind == "blitz"
        now = time.time()
        timed_out = False
        if blitz:  # the server decides when time is up
            deadline = fight.deadline or now
            if choice is None:
                if now < deadline - 1.0:
                    raise GameError(409, "Time is not up yet")
                timed_out = True
            elif now > deadline + BLITZ_GRACE_S:
                timed_out = True
        elif choice is None:
            raise GameError(400, "Typed answers are not supported yet; send choice")
        if choice is not None and not 0 <= choice < len(fq.choices):
            raise GameError(400, "Choice out of range")

        correct = not timed_out and choice == fq.answer
        blocked = False
        run.answered += 1
        attempt = Attempt(user_id, fq.source.q_id, fq.source.deck_id, fq.deck_name, fq.source.subtopic_no,
                          fq.subtopic, correct, time.time(), fq.source.page, fq.source.quote)
        if not run.judge:  # judge runs do not touch the player's history (weak spots, replays)
            _attempts.append(attempt)
            store.write("insert_attempt", {
                "user_id": user_id, "q_id": attempt.q_id, "deck_id": attempt.deck_id,
                "deck_name": attempt.deck_name, "subtopic_no": attempt.subtopic_no, "subtopic": attempt.subtopic,
                "correct": correct, "page_no": attempt.page, "quote": attempt.quote, "answered_at": attempt.at})
        fight.queue.pop(0)
        taunts = TAUNTS.get(fight.node.enemy, GENERIC_TAUNTS)
        if correct:
            run.correct += 1
            fight.enemy_hp -= 1
            taunt = random.choice(taunts["hit"])
            quote = None
        else:
            if run.shield:  # Aegis Ward takes the hit
                run.shield = False
                blocked = True
            else:
                run.hp -= 1
            run.misses.append(fq.source)
            if not blitz:
                fight.queue.append(q_id)  # a missed question comes back at the end of the fight
            taunt = random.choice(taunts["miss"])
            quote = {"text": clean_math(fq.source.quote), "page": fq.source.page, "deck_name": fq.deck_name}

        # A Blitz round ends when its questions run out; other fights when the enemy is down.
        node_cleared = not fight.queue if blitz else fight.enemy_hp <= 0
        if blitz and fight.queue:
            fight.deadline = now + (AFTER_HIT_S if correct else AFTER_MISS_S) + BLITZ_LIMIT_MS / 1000
        run_over = None
        if run.hp <= 0:
            run_over = _finish(run, "lost")
        elif node_cleared:
            if _open_next(run, fight.node):
                run.fight = None
            else:
                run_over = _finish(run, "won")
        _save(run)

        response = {
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
            "score": run.correct * 100,
            "blocked": blocked,
            "timed_out": timed_out,
            "time_left_ms": BLITZ_LIMIT_MS if blitz and fight.queue and not node_cleared else None,
        }
        run.last_answer = (q_id, response)
        return response


def take_treasure(run_id: str, node_id: str, choice_id: str) -> dict:
    _ensure_run(run_id)
    with _lock:
        run = _run(run_id)
        node = next((n for n in run.nodes if n.node_id == node_id), None)
        if run.status != "active" or node is None or node.kind != "treasure" or node.status != "open":
            raise GameError(409, "That chest is not open")
        choice = next((c for c in _treasure(run, node)["choices"] if c["choice_id"] == choice_id), None)
        if choice is None:
            raise GameError(400, "That item is not in this chest")
        run.items[choice["item_id"]] = run.items.get(choice["item_id"], 0) + 1
        _open_next(run, node)  # the summit always follows a chest
        _save(run)
        return {"items": _items(run), "hp": run.hp, "max_hp": run.max_hp}


def use_item(run_id: str, item_id: str, q_id: str | None) -> dict:
    _ensure_run(run_id)
    with _lock:
        run = _run(run_id)
        if run.status != "active":
            raise GameError(409, "This run is over")
        if run.items.get(item_id, 0) < 1:
            raise GameError(409, "You do not have that item")
        extra: dict = {}
        if item_id in ("split_rune", "sages_whisper"):
            fight = run.fight
            if fight is None or not fight.queue or fight.queue[0] != q_id:
                raise GameError(409, "Use it on the current question")
            fq = fight.questions[q_id]
            if item_id == "split_rune":  # hide two wrong choices, never the right one
                wrong = [i for i in range(len(fq.choices)) if i != fq.answer]
                extra["remove"] = sorted(random.sample(wrong, min(2, len(wrong))))
            else:
                words = clean_math(fq.source.quote).split()
                nudge = " ".join(words[:max(4, len(words) // 2)])
                extra["hint"] = (f"Slide {fq.source.page}: " if fq.source.page else "") + f"\u201c{nudge}...\u201d"
        elif item_id == "heartstone":
            run.hp += 1
            run.max_hp = max(run.max_hp, run.hp)
        elif item_id == "aegis_ward":
            run.shield = True
            extra["shield"] = True
        else:
            raise GameError(400, "Unknown item")
        run.items[item_id] -= 1
        _save(run)
        return {"items": _items(run), "player_hp": run.hp, **extra}


def report(user_id: str) -> dict:
    _ensure_user(user_id)
    with _lock:
        mine = [a for a in _attempts if a.user_id == user_id]
        scores = _scores.get(user_id, [])
    groups: dict[tuple[str, int], dict] = {}
    missed: dict[tuple[str, int], dict[tuple[int | None, str], int]] = {}
    for a in mine:
        key = (a.deck_id, a.subtopic_no)
        g = groups.setdefault(key, {
            "deck_id": a.deck_id, "deck_name": a.deck_name, "subtopic": a.subtopic, "answered": 0, "correct": 0})
        g["answered"] += 1
        g["correct"] += a.correct
        if not a.correct and a.quote:
            slides = missed.setdefault(key, {})
            slides[(a.page, a.quote)] = slides.get((a.page, a.quote), 0) + 1
    subtopics = sorted(
        ({**g, "accuracy": round(g["correct"] / g["answered"], 2),
          "missed_slides": [{"page": page, "text": clean_math(text), "missed": n}
                            for (page, text), n in sorted(missed.get(key, {}).items(), key=lambda kv: -kv[1])[:3]]}
         for key, g in groups.items()),
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


def scores(deck_id: str) -> dict:
    """Top 10 for a cartridge: Snowflake rows plus any not written yet."""
    rows = {r[0]: {"player_name": r[1] or "PLAYER", "score": int(r[2]), "accuracy": r[3], "time_s": r[4],
                   "at": int(float(r[5]) * 1000)}
            for r in store.read("deck_scores", {"deck_id": deck_id})}
    with _lock:
        for r in _recent_scores.get(deck_id, []):
            rows.setdefault(r["run_id"], {"player_name": r["player_name"], "score": r["score"],
                                          "accuracy": r["accuracy"], "time_s": r["time_s"],
                                          "at": int(r["played_at"] * 1000)})
    top = sorted(rows.values(), key=lambda r: (-r["score"], r["at"]))[:10]
    return {"scores": top}
