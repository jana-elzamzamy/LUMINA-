# Lumina — Setup (Python + SQLite)

This is the **easy** setup. You only need **Python 3** (you already have it).

The backend lives in one file (`server.py`) and stores everything in a single
SQLite database file (`lumina.db`) that's created automatically the first
time you run it. No SQL Server, no XAMPP, no driver DLLs.

---

## Run it (one command)

Open a terminal in the project folder and run:

```
python server.py
```

You should see:

```
Created fresh database at C:\...\Lumina-Website\lumina.db
Lumina is running. Open http://127.0.0.1:8000/ in your browser. Press Ctrl+C to stop.
```

Now open **http://127.0.0.1:8000/** in your browser. Everything works:
the website loads, and every button (preferences, sign-language, TTS, image
detection) talks to the real backend.

To stop the server, press **Ctrl+C** in the terminal.

---

## What's running?

| Thing | Where |
|---|---|
| Backend code | `server.py` (Python standard library only) |
| Database file | `lumina.db` (auto-created, SQLite) |
| API endpoints | `http://127.0.0.1:8000/api/...` |
| Website | `http://127.0.0.1:8000/index.html` (and other pages) |

The first run creates `lumina.db` with seed data (5 users, 4 features,
3 AI models). After that, every run reuses the same file, so your saved
preferences and history persist.

---

## Database schema

The schema is built into `server.py` (see the `SCHEMA_SQL` string near the top).
Tables: `User`, `UserPreference`, `Feature`, `AIModel`, `UsageLog`,
`DetectionResult`, `DetectedObject`, `GestureHistory`, `TTSHistory`.

If you want to look inside the database file, two free options:

- **DB Browser for SQLite** — https://sqlitebrowser.org/ (GUI, easiest)
- **sqlite3 command line** — `python -m sqlite3 lumina.db`

---

## Reset the database

Stop the server, delete `lumina.db`, and run `python server.py` again.
A fresh database is created with the seed data.

---

## What about the old PHP / SQL Server files?

They're still in the project (`api/*.php`, `database/lumina_schema_mssql.sql`)
in case you ever want to deploy to a real PHP host, but you do **not** need
them for local development. Just use `server.py`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `python: command not found` | Try `py server.py` instead, or install Python from python.org |
| `Address already in use` | Something is on port 8000. Stop it, or change `PORT = 8000` near the top of `server.py` |
| API calls show "offline" in the browser console | Make sure the server terminal is still running. Refresh the page. |
| Want to wipe data | Stop server, delete `lumina.db`, restart |

That's it. If you can run `python server.py`, the backend is done.
