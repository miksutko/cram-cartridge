# Cram Cartridge

Cram Cartridge: hackathon web app built with JetBrains Air (required rule). Product design is NOT final; do not invent features. Build only what the current task asks.

Current phase: SETUP ONLY

## Stack

- Frontend: React + TypeScript on Vite, ESLint
- Backend: Python 3.11+, FastAPI, uvicorn, snowflake-connector-python, python-dotenv
- Database: Snowflake SQL files
- IDE: IntelliJ IDEA Ultimate with JetBrains Air (Python plugin for backend, Database tool window for Snowflake)

## Layout

- `frontend/`: React + TypeScript app on Vite (owner: A)
- `backend/`: FastAPI package, run from the repo root (owner: B)
- `sql/`: Snowflake SQL files (owner: B)
- `docs/`: shared notes
- `.junie/`: Junie guidelines (`guidelines.md` has the same content as CLAUDE.md and AGENTS.md)

## Commands

- Backend, from the repo root: `uvicorn backend.main:app --reload --port 8000`
- Frontend: `cd frontend && npm run dev` (Vite proxies `/api` to :8000)

## Rules

- Long-running servers: start them in the background, check they respond, then stop them. Never block the session on a dev server.
- Python imports: backend is a package run from the repo root. Use `from backend.x import ...` or `from .x import ...`, never `import x`.
- Ownership: A edits only `frontend/`. B edits only `backend/` and `sql/`. Shared files (CLAUDE.md, AGENTS.md, `.junie/`, `docs/`, README.md) change only after telling the other person.
- Git: `git pull --rebase` before every push, small commits starting with "Air: ", push often, never force-push main.
- Secrets: Snowflake credentials live only in `.env` at the repo root, read by the backend. Never commit `.env`, never send keys to the browser, never hardcode them.
- No new dependencies without asking.
