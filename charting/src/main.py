"""FastAPI application factory with lifespan."""
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.adapter.persistence.symbol_repository import SymbolRepository
from src.adapter.scheduler.daily_ingestion_scheduler import DailyIngestionScheduler
from src.application.usecase.ingest_symbol_data_usecase import IngestSymbolDataUseCase
from src.adapter.client.yahoo_finance_client import YahooFinanceClient
from src.adapter.computation.numpy_feature_extractor import NumpyFeatureExtractor
from src.adapter.persistence.ohlcv_repository import OhlcvRepository
from src.adapter.persistence.pattern_repository import PatternRepository
from src.config.database import get_session_factory
from src.config.settings import get_settings
from src.presentation.router import ohlcv_router, similarity_router, symbol_router, sync_router

logger = structlog.get_logger(__name__)

_scheduler: DailyIngestionScheduler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    settings = get_settings()
    logger.info("Starting Charting API", env=settings.app_env)

    # Initialize scheduler
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        _scheduler = DailyIngestionScheduler(
            symbol_repo=SymbolRepository(db),
            ingest_usecase=IngestSymbolDataUseCase(
                symbol_repo=SymbolRepository(db),
                ohlcv_repo=OhlcvRepository(db),
                pattern_repo=PatternRepository(db),
                market_client=YahooFinanceClient(),
                feature_extractor=NumpyFeatureExtractor(),
            ),
            ohlcv_repo=OhlcvRepository(db),
            pattern_repo=PatternRepository(db),
        )
        _scheduler.start()
    finally:
        db.close()

    yield

    if _scheduler:
        _scheduler.stop()
    logger.info("Charting API shutdown complete")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Charting API",
        description="Chart similarity analysis and forecast service",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(symbol_router.router)
    app.include_router(ohlcv_router.router)
    app.include_router(similarity_router.router)
    app.include_router(sync_router.router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
