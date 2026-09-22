# EXTREME-CW

Carwash POS & weekly ledger for EXTREME Car Wash — Eldoret.

- **Frontend**: React + TypeScript + Vite (`frontend/`)
- **Backend**: FastAPI + SQLAlchemy (`backend/`)
- **Database**: Supabase Postgres (migrations in `supabase/migrations/`)
- **SMS payments**: M-Pesa / bank SMS parsing with tip & misc classification

## Stack

| Piece      | Tech                                    |
|------------|-----------------------------------------|
| Frontend   | React, TypeScript, Vite, Tailwind       |
| Backend    | Python, FastAPI, SQLAlchemy             |
| DB         | Supabase PostgreSQL (dev: SQLite)       |
| Auth       | JWT (admin / manager / employee roles)  |

## Local dev

```sh
# backend (SQLite by default; set DATABASE_URL to use Postgres)
./python/bin/python -m uvicorn app.main:app --app-dir backend --port 8000

# frontend
cd frontend && npm install && npm run dev
```

## Deploy

- Vercel: framework preset **Vite**, root directory `frontend`, env `VITE_API_URL`.
- Supabase: `supabase login` (token as `SUPABASE_ACCESS_TOKEN`), then `supabase db push`.