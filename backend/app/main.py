from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config import CORS_ORIGINS, POLL_INTERVAL_SECONDS, SEED_DEMO_DATA
from app.database import create_db_and_tables
from app.services import poll_mediamtx_once, seed_demo_data


logger = logging.getLogger(__name__)


async def poll_mediamtx_loop() -> None:
    while True:
        try:
            await poll_mediamtx_once()
        except Exception:
            # 監視先の一時障害でAPI全体のバックグラウンドタスクを止めない。
            logger.exception("MediaMTX polling failed")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    if SEED_DEMO_DATA:
        # デモデータは明示的に有効化した時だけ投入し、本番DBを勝手に汚さない。
        seed_demo_data()
    poll_task = asyncio.create_task(poll_mediamtx_loop())
    try:
        yield
    finally:
        poll_task.cancel()
        try:
            await poll_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="SI-League API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
