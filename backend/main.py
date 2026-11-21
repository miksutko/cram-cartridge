from fastapi import FastAPI

app = FastAPI(title="Cram Cartridge API")


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}
