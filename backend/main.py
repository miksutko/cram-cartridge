import logging
from typing import Any

from fastapi import FastAPI

from .db import ping

logger = logging.getLogger(__name__)

app = FastAPI(title="Cram Cartridge API")


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        version = ping()
    except Exception as exc:
        logger.warning("Snowflake health check failed: %s", exc)
        return {"ok": True, "snowflake": False, "error": str(exc)}
    return {"ok": True, "snowflake": True, "version": version}
