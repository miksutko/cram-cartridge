"""POST /api/upload: PDF -> Snowflake stage -> parse, chunk, embed, topics, questions.

All AI work runs inside Snowflake. Python only moves rows and checks the JSON the
model returns.
"""

import hashlib
import io
import json
import re
import time
import uuid
from typing import Any

from . import db
from .decks import Deck, Question, Subtopic, get_deck, remember
from .queries import q

MAX_PDF_BYTES = 50 * 1024 * 1024
QUESTIONS_PER_SUBTOPIC = 5
MIN_QUESTIONS = 3

TOPIC_PROMPT = """You are turning lecture slides into a study game.
Read the slides below. Reply with ONLY a JSON object and no other text, in exactly this shape:
{"main_topic": "2 to 5 words", "subtopics": [{"name": "2 to 5 words", "description": "one sentence"}]}
Give 3 to 5 subtopics that together cover the lecture, in the order it teaches them.

SLIDES:
"""

QUESTION_PROMPT = f"""Write {QUESTIONS_PER_SUBTOPIC} multiple-choice quiz questions that test the SLIDES below.
Reply with ONLY a JSON array and no other text. Each item must look exactly like this:
{{"question": "...", "choices": ["...", "...", "...", "..."], "answer": 0, "explanation": "one sentence", "page": 3, "quote": "..."}}
Rules:
- exactly 4 short choices; "answer" is the 0-based index of the correct choice
- exactly ONE choice may be correct: every wrong choice must be clearly false according to the slides
- wrong choices must still be plausible to someone who did not revise
- every question must be answerable from the slides alone
- "page" is the page number shown in [page N] where the answer comes from
- "quote" is one sentence copied word for word from that page that contains the answer"""


class UploadError(Exception):
    pass


class Trace:
    """Times every Snowflake call for the Snowflake panel."""

    def __init__(self) -> None:
        self.steps: list[dict[str, Any]] = []

    def run(self, cur, fn: str, sql: str, params: Any = None, many: bool = False, **kwargs) -> None:
        start = time.perf_counter()
        if many:
            cur.executemany(sql, params)
        else:
            cur.execute(sql, params, **kwargs)
        self.steps.append({
            "fn": fn,
            "ms": round((time.perf_counter() - start) * 1000),
            "rows": cur.rowcount,
        })


def ai_text(value: Any) -> str:
    """AI_COMPLETE comes back JSON-encoded (a quoted string); unwrap it to plain text."""
    text = "" if value is None else str(value)
    stripped = text.strip()
    if stripped.startswith('"') and stripped.endswith('"'):
        try:
            decoded = json.loads(stripped)
            if isinstance(decoded, str):
                return decoded
        except json.JSONDecodeError:
            pass
    return text


def extract_json(text: str, opener: str) -> Any:
    closer = "}" if opener == "{" else "]"
    start, end = text.find(opener), text.rfind(closer)
    if start < 0 or end <= start:
        raise ValueError("no JSON in model reply")
    snippet = text[start:end + 1]
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        # The model often copies LaTeX (\neg, \leftrightarrow) into JSON strings: an invalid
        # escape. Turn known commands into symbols, escape any other stray backslash, retry.
        snippet = re.sub(r"\\{1,2}([A-Za-z]+)(?![A-Za-z])",
                         lambda m: _LATEX.get(m.group(1), m.group(0)), snippet)
        return json.loads(re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", snippet))


_LATEX = {
    "neg": "¬", "lnot": "¬", "lor": "∨", "vee": "∨", "land": "∧", "wedge": "∧", "to": "→",
    "rightarrow": "→", "Rightarrow": "⇒", "leftrightarrow": "↔", "Leftrightarrow": "⇔", "models": "⊨",
    "vDash": "⊨", "vdash": "⊢", "equiv": "≡", "ldots": "…", "dots": "…", "cdots": "…", "in": "∈",
    "notin": "∉", "cup": "∪", "cap": "∩", "subseteq": "⊆", "subset": "⊂", "emptyset": "∅", "forall": "∀",
    "exists": "∃", "leq": "≤", "le": "≤", "geq": "≥", "ge": "≥", "neq": "≠", "ne": "≠", "times": "×",
    "infty": "∞", "top": "⊤", "bot": "⊥", "cdot": "·", "quad": " ", "qquad": " ", "mapsto": "↦",
    "leftarrow": "←", "Leftarrow": "⇐", "iff": "⇔", "implies": "⇒", "mid": "|", "circ": "∘",
    "oplus": "⊕", "sim": "~", "prime": "′", "ell": "ℓ", "langle": "⟨", "rangle": "⟩",
}


def clean_math(text: str) -> str:
    """Turn the LaTeX that AI_PARSE_DOCUMENT emits ($\\neg P \\lor Q$) into readable symbols."""
    text = re.sub(r"\\(?:mathcal|mathrm|mathbf|mathit|text|operatorname)\{([^{}]*)\}", r"\1", text)
    text = re.sub(r"\\([A-Za-z]+)(?![A-Za-z])", lambda m: _LATEX.get(m.group(1), m.group(0)), text)
    text = re.sub(r"[_^]\{([^{}]*)\}", r"\1", text)
    text = text.replace(r"\{", "{").replace(r"\}", "}").replace("\\,", " ").replace("$", "")
    return re.sub(r"¬\s+", "¬", text)


def _plain(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[#*|`>]", " ", clean_math(text or ""))).strip()


def _norm(text: str) -> str:
    return _plain(text).lower()


def _trim(text: str, limit: int = 240) -> str:
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "..."


def _words(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.lower()))


def _best_sentence(content: str, hint: str) -> str:
    """The sentence (or line) on a page that shares the most words with the hint."""
    plain = _plain(content)
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+|\s-\s", plain) if len(p.strip()) > 15] or [plain]
    wanted = _words(hint)
    return _trim(max(parts, key=lambda part: len(wanted & _words(part))))


def _answer_index(raw: Any, choices: list[str]) -> int | None:
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int):
        return raw if 0 <= raw < len(choices) else None
    if isinstance(raw, str):
        value = raw.strip()
        if value.isdigit():
            return _answer_index(int(value), choices)
        if len(value) == 1 and value.upper() in "ABCD":
            return "ABCD".index(value.upper())
        lowered = [c.lower() for c in choices]
        if value.lower() in lowered:
            return lowered.index(value.lower())
    return None


def _source(item: dict, prompt: str, answer: str, pages: dict[int, str]) -> tuple[int | None, str]:
    """Return (page, quote) where the quote really comes from the slides."""
    quote = _plain(str(item.get("quote", "")))
    page = item.get("page")
    page = int(page) if isinstance(page, (int, str)) and str(page).isdigit() and int(page) in pages else None
    if quote:
        wanted = quote.lower()
        if page and wanted in _norm(pages[page]):
            return page, _trim(quote)
        for no, content in pages.items():
            if wanted in _norm(content):
                return no, _trim(quote)
    hint = f"{quote} {prompt} {answer}"
    if page is None:  # the page sharing the most words with the question
        page = max(pages, key=lambda no: len(_words(hint) & _words(_plain(pages[no]))), default=None)
    return page, _best_sentence(pages.get(page, ""), hint) if page else ""


def clean_questions(reply: str, pages: dict[int, str]) -> list[dict]:
    try:
        items = extract_json(reply or "", "[")
    except (ValueError, json.JSONDecodeError):
        return []
    out = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        prompt = clean_math(str(item.get("question", ""))).strip()
        choices = [clean_math(str(c)).strip() for c in item.get("choices", []) if str(c).strip()]
        if not prompt or len(choices) != 4 or len({c.lower() for c in choices}) != 4:
            continue
        answer = _answer_index(item.get("answer"), choices)
        if answer is None:
            continue
        page, quote = _source(item, prompt, choices[answer], pages)
        out.append({
            "prompt": prompt,
            "choices": choices,
            "answer": answer,
            "explanation": clean_math(str(item.get("explanation", ""))).strip(),
            "page": page,
            "quote": quote,
        })
    return out


def _cached_upload(deck_id: str, trace: Trace) -> dict | None:
    """The response for a cartridge that was already built from the same PDF."""
    deck = get_deck(deck_id)
    if deck is None:
        return None
    with db.get_connection() as conn, conn.cursor() as cur:
        cur.execute(q("subtopic_chunk_counts"), {"deck_id": deck_id})
        chunks = {int(no): int(n) for no, n in cur.fetchall() if no is not None}
    return {
        "deck_id": deck.deck_id,
        "name": deck.name,
        "main_topic": deck.main_topic,
        "subtopics": [{"subtopic_no": s.no, "name": s.name, "chunks": chunks.get(s.no, 0),
                       "questions": sum(1 for x in deck.questions if x.subtopic_no == s.no)}
                      for s in deck.subtopics],
        "slides": deck.slide_count,
        "chunks": deck.chunk_count,
        "trace": trace.steps,
        "cached": True,
    }


def ingest(pdf: bytes, name: str) -> dict:
    deck_id = uuid.uuid4().hex
    file_name = f"{deck_id}.pdf"
    file_hash = hashlib.sha256(pdf).hexdigest()
    params = {"deck_id": deck_id}
    trace = Trace()

    with db.get_connection() as conn:
        db.ensure_schema(conn)
        cur = conn.cursor()
        trace.run(cur, "Cache check (same PDF?)", q("find_deck_by_hash"), {"file_hash": file_hash})
        existing = cur.fetchone()
        cur.close()
    if existing:
        cached = _cached_upload(existing[0], trace)
        if cached:
            return cached

    with db.get_connection() as conn:
        db.ensure_schema(conn)
        cur = conn.cursor()
        try:
            trace.run(cur, "PUT @slides", q("put_pdf").format(file_name=file_name), file_stream=io.BytesIO(pdf))
            cur.execute(q("refresh_stage"))
            cur.execute(q("insert_deck"), {**params, "name": name, "file_name": file_name, "file_hash": file_hash})

            trace.run(cur, "AI_PARSE_DOCUMENT", q("parse_slides"), {**params, "file_name": file_name})
            slide_count = cur.rowcount or 0
            if not slide_count:
                raise UploadError("AI_PARSE_DOCUMENT returned no pages")

            trace.run(cur, "SPLIT_TEXT_RECURSIVE_CHARACTER", q("split_chunks"), params)
            chunk_count = cur.rowcount or 0
            if not chunk_count:
                raise UploadError("No text found in the PDF")

            trace.run(cur, "AI_EMBED (chunks)", q("embed_chunks"), params)

            cur.execute(q("deck_text"), params)
            deck_text = (cur.fetchone() or [""])[0] or ""
            trace.run(cur, "AI_COMPLETE (topics)", q("complete"), {"prompt": TOPIC_PROMPT + deck_text[:15000]})
            reply = ai_text((cur.fetchone() or [""])[0])
            try:
                topics = extract_json(reply, "{")
                main_topic = str(topics["main_topic"]).strip() or name
                raw_subtopics = [s for s in topics["subtopics"] if str(s.get("name", "")).strip()][:5]
            except (ValueError, KeyError, TypeError, AttributeError, json.JSONDecodeError) as exc:
                raise UploadError(f"Could not read topics from AI_COMPLETE: {reply[:200]}") from exc
            if not raw_subtopics:
                raise UploadError("AI_COMPLETE returned no subtopics")

            trace.run(cur, "INSERT subtopics", q("insert_subtopic"), [
                {**params, "subtopic_no": i + 1, "name": str(s["name"]).strip()[:80],
                 "description": str(s.get("description", "")).strip()[:300]}
                for i, s in enumerate(raw_subtopics)
            ], many=True)
            trace.run(cur, "AI_EMBED (subtopics)", q("embed_subtopics"), params)
            trace.run(cur, "VECTOR_COSINE_SIMILARITY", q("assign_subtopics"), params)

            trace.run(cur, "AI_COMPLETE (questions)", q("generate_questions"),
                      {**params, "instructions": QUESTION_PROMPT})
            replies = cur.fetchall()

            cur.execute(q("deck_slides"), params)
            pages = {int(no): content or "" for no, content in cur.fetchall()}

            question_rows, by_subtopic = [], {}
            for subtopic_no, reply in replies:
                cleaned = clean_questions(ai_text(reply), pages)
                by_subtopic[int(subtopic_no)] = len(cleaned)
                for item in cleaned:
                    question_rows.append({
                        **params, "q_no": len(question_rows), "subtopic_no": int(subtopic_no),
                        "prompt": item["prompt"], "choices_json": json.dumps(item["choices"]),
                        "answer_index": item["answer"], "explanation": item["explanation"],
                        "page_no": item["page"], "quote": item["quote"],
                    })
            if not any(count >= MIN_QUESTIONS for count in by_subtopic.values()):
                raise UploadError("AI_COMPLETE did not return enough usable questions")
            trace.run(cur, "INSERT questions", q("insert_question"), question_rows, many=True)

            cur.execute(q("subtopic_chunk_counts"), params)
            chunks_per_subtopic = {int(no): int(n) for no, n in cur.fetchall() if no is not None}
            cur.execute(q("finish_deck"), {**params, "main_topic": main_topic,
                                           "slide_count": slide_count, "chunk_count": chunk_count})
        except Exception:
            try:
                cur.execute(q("fail_deck"), params)
            except Exception:
                pass
            raise
        finally:
            cur.close()

    subtopics = tuple(Subtopic(i + 1, str(s["name"]).strip()[:80]) for i, s in enumerate(raw_subtopics))
    deck = Deck(
        deck_id=deck_id, name=name, main_topic=main_topic, source="snowflake", subtopics=subtopics,
        questions=tuple(
            Question(f"{deck_id}:{r['q_no']}", deck_id, r["subtopic_no"], r["prompt"],
                     tuple(json.loads(r["choices_json"])), r["answer_index"], r["explanation"],
                     r["page_no"], r["quote"])
            for r in question_rows
        ),
        slide_count=slide_count, chunk_count=chunk_count,
    )
    remember(deck)

    return {
        "deck_id": deck_id,
        "name": name,
        "main_topic": main_topic,
        "subtopics": [
            {"subtopic_no": s.no, "name": s.name, "chunks": chunks_per_subtopic.get(s.no, 0),
             "questions": by_subtopic.get(s.no, 0)}
            for s in subtopics
        ],
        "slides": slide_count,
        "chunks": chunk_count,
        "trace": trace.steps,
    }
