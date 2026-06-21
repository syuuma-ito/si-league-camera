# SI-League Backend

FastAPI backend for managing video streams, scenes, active scene state, and MediaMTX connection status.

## Environment

- `SI_LEAGUE_DATABASE_PATH`: SQLite database path. Defaults to `backend/database.db`.
- `SI_LEAGUE_MEDIAMTX_API_URL`: MediaMTX API base URL. Defaults to `http://localhost:9997`.
- `SI_LEAGUE_POLL_INTERVAL_SECONDS`: MediaMTX polling interval. Defaults to `2.0`.
- `SI_LEAGUE_CORS_ORIGINS`: Comma-separated allowed origins. Defaults to `*`.
- `SI_LEAGUE_SEED_DEMO_DATA`: Set to `true` to create the sample Camera 1-8 streams on an empty database. Defaults to `false`.

## Run

```bash
uv run uvicorn app.main:app --reload
```
