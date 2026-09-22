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

### Own server (backend)

`backend/` is just a FastAPI app — deployable on any always-on box.

1. Create `.env` next to the repo root (already gitignored):

   ```sh
   DATABASE_URL=postgresql://postgres.uiovshfqcrqbluvxhzif:YOURPASSWORD@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
   SECRET_KEY=<long random string>
   CORS_ORIGINS=https://extreme-cw.vercel.app
   ```

2. Run with your Python venv:

   ```sh
   ./python/bin/python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
   ```

3. systemd (`/etc/systemd/system/carwash-backend.service`):

   ```ini
   [Unit]
   Description=Carwash POS API
   After=network.target

   [Service]
   WorkingDirectory=/home/<user>/EXTREM-CW
   ExecStart=/home/<user>/EXTREM-CW/python/bin/python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```

Surround the API with a reverse proxy (Caddy/nginx + TLS). Put the public URL in the Vercel `VITE_API_URL` env var and redeploy.# EXTREME-CW
