import logging
import threading
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from . import db, game, stats as stats_module, store
from .decks import hide_deck, list_decks, warm_cache
from .ingest import MAX_PDF_BYTES, UploadError, ingest

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    if db.configured():  # load the uploaded cartridges in the background so first fights are quick
        threading.Thread(target=warm_cache, name="warm-decks", daemon=True).start()
        threading.Thread(target=stats_module.refresh, name="warm-stats", daemon=True).start()
    yield
    # Stopping or reloading the server: let queued game writes reach Snowflake first.
    if not store.flush(15):
        logger.warning("Some game writes did not reach Snowflake before shutdown")


app = FastAPI(title="Cram Cartridge API", lifespan=lifespan)


class RunRequest(BaseModel):
    user_id: str
    deck_id: str
    player_name: str | None = None
    judge: bool = False  # the judge's climb (also on with the name JUDGE)


class NodeRequest(BaseModel):
    run_id: str
    node_id: str


class TreasureRequest(BaseModel):
    run_id: str
    node_id: str
    choice_id: str


class ItemRequest(BaseModel):
    run_id: str
    item_id: str
    q_id: str | None = None


class AnswerRequest(BaseModel):
    user_id: str
    run_id: str
    q_id: str
    choice: int | None = None
    text: str | None = None


def _game(call, *args) -> dict:
    try:
        return call(*args)
    except game.GameError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        version = db.ping()
    except Exception as exc:
        logger.warning("Snowflake health check failed: %s", exc)
        return {"ok": True, "snowflake": False, "error": str(exc)}
    return {"ok": True, "snowflake": True, "version": version}


@app.get("/api/decks")
def decks() -> dict[str, Any]:
    items, error = list_decks()
    return {"decks": items, "snowflake_error": error}


@app.delete("/api/decks/{deck_id}")
def delete_deck(deck_id: str) -> dict[str, Any]:
    if not hide_deck(deck_id):
        raise HTTPException(status_code=404, detail="That cartridge cannot be removed")
    return {"ok": True}


@app.post("/api/upload")
def upload(file: UploadFile = File(...), name: str = Form(...)) -> dict[str, Any]:
    name = name.strip()[:80]
    if not name:
        raise HTTPException(status_code=400, detail="Give the cartridge a name")
    data = file.file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF is larger than 50 MB")
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="That file is not a PDF")
    if not db.configured():
        raise HTTPException(status_code=503, detail="Upload needs Snowflake: fill in .env")
    try:
        return ingest(data, name)
    except UploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Upload failed")
        raise HTTPException(status_code=502, detail=f"Snowflake error: {exc}") from exc


@app.post("/api/run")
def run(body: RunRequest) -> dict[str, Any]:
    return _game(game.start_run, body.user_id, body.deck_id, body.player_name, body.judge)


@app.get("/api/map")
def map_(run_id: str) -> dict[str, Any]:
    return _game(game.get_map, run_id)


@app.post("/api/node")
def node(body: NodeRequest) -> dict[str, Any]:
    return _game(game.enter_node, body.run_id, body.node_id)


@app.post("/api/answer")
def answer(body: AnswerRequest) -> dict[str, Any]:
    return _game(game.answer, body.user_id, body.run_id, body.q_id, body.choice)


@app.post("/api/treasure")
def treasure(body: TreasureRequest) -> dict[str, Any]:
    return _game(game.take_treasure, body.run_id, body.node_id, body.choice_id)


@app.post("/api/item")
def item(body: ItemRequest) -> dict[str, Any]:
    return _game(game.use_item, body.run_id, body.item_id, body.q_id)


@app.get("/api/report")
def report(user_id: str) -> dict[str, Any]:
    return game.report(user_id)


@app.get("/api/stats")
def stats(user_id: str) -> dict[str, Any]:
    return stats_module.stats(user_id)


@app.get("/api/scores")
def scores(deck_id: str) -> dict[str, Any]:
    return game.scores(deck_id)
