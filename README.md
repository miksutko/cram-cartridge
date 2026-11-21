# Cram Cartridge

Built with JetBrains Air (Claude Code and Junie agents)

## Running locally

Backend (Python 3.11+, run from the repo root):

```
python3 -m venv backend/.venv
source backend/.venv/bin/activate      # Windows: backend\.venv\Scripts\activate
pip install -r backend/requirements.txt
cp .env.example .env                    # then fill in the Snowflake values
uvicorn backend.main:app --reload --port 8000
```

Frontend:

```
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Requests to `/api` are proxied to the backend on port 8000.
