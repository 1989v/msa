"""DailyIngestionScheduler — APScheduler jobs for daily OHLCV ingest and return realization."""
from datetime import date, timedelta

import structlog
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from src.application.usecase.ingest_symbol_data_usecase import IngestSymbolDataUseCase
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort
from src.domain.port.pattern_repository_port import PatternRepositoryPort
from src.domain.port.symbol_repository_port import SymbolRepositoryPort

logger = structlog.get_logger(__name__)


class DailyIngestionScheduler:
    """Wraps APScheduler for daily market data ingestion jobs."""

    def __init__(
        self,
        symbol_repo: SymbolRepositoryPort,
        ingest_usecase: IngestSymbolDataUseCase,
        ohlcv_repo: OhlcvRepositoryPort,
        pattern_repo: PatternRepositoryPort,
    ) -> None:
        self._symbol_repo = symbol_repo
        self._ingest_usecase = ingest_usecase
        self._ohlcv_repo = ohlcv_repo
        self._pattern_repo = pattern_repo
        self._scheduler = BackgroundScheduler(timezone="Asia/Seoul")

    def start(self) -> None:
        # US stocks: after US market close (07:00 KST = 22:00 UTC prev day)
        self._scheduler.add_job(
            self._ingest_us,
            CronTrigger(day_of_week="mon-fri", hour=7, minute=0, timezone="Asia/Seoul"),
            id="daily_us_ingest",
            replace_existing=True,
        )
        # KR stocks: after KRX close (18:00 KST)
        self._scheduler.add_job(
            self._ingest_kr,
            CronTrigger(day_of_week="mon-fri", hour=18, minute=0, timezone="Asia/Seoul"),
            id="daily_kr_ingest",
            replace_existing=True,
        )
        # Realize forward returns for matured patterns (19:00 KST)
        self._scheduler.add_job(
            self._realize_returns,
            CronTrigger(day_of_week="mon-fri", hour=19, minute=0, timezone="Asia/Seoul"),
            id="realize_returns",
            replace_existing=True,
        )
        self._scheduler.start()
        logger.info("DailyIngestionScheduler started")

    def stop(self) -> None:
        self._scheduler.shutdown(wait=False)
        logger.info("DailyIngestionScheduler stopped")

    def _ingest_us(self) -> None:
        self._ingest_by_market("US")

    def _ingest_kr(self) -> None:
        self._ingest_by_market("KR")

    def _ingest_by_market(self, market: str) -> None:
        symbols = [s for s in self._symbol_repo.find_all_active() if s.market == market]
        logger.info("Starting daily ingest", market=market, symbols=len(symbols))
        for symbol in symbols:
            try:
                result = self._ingest_usecase.execute(symbol.ticker)
                logger.info("Ingested", **result)
            except Exception as e:
                logger.error("Ingest failed", ticker=symbol.ticker, error=str(e))

    def _realize_returns(self) -> None:
        """Update realized forward returns for patterns where the future window has elapsed."""
        today = date.today()
        patterns = self._pattern_repo.find_unrealized_returns(as_of=today)
        logger.info("Realizing returns for matured patterns", count=len(patterns))

        for pattern in patterns:
            try:
                r5 = self._compute_return(pattern.symbol_id, pattern.window_end, days=5)
                r20 = self._compute_return(pattern.symbol_id, pattern.window_end, days=20)
                r60 = self._compute_return(pattern.symbol_id, pattern.window_end, days=60)
                if r5 is not None or r20 is not None or r60 is not None:
                    pattern_id = pattern.id
                    if pattern_id is not None:
                        self._pattern_repo.update_returns(pattern_id, r5, r20, r60)
            except Exception as e:
                logger.error("Return realization failed", pattern_id=pattern.id, error=str(e))

    def _compute_return(self, symbol_id: int, window_end: date, days: int) -> float | None:
        """Compute the forward return starting the day after window_end."""
        future_start = window_end + timedelta(days=1)
        future_end = window_end + timedelta(days=days + 10)  # buffer for non-trading days
        bars = self._ohlcv_repo.find_by_symbol(symbol_id, start=future_start, end=future_end)
        if len(bars) < days:
            return None  # not enough future data yet
        base_close = float(bars[0].close)
        target_close = float(bars[days - 1].close)
        if base_close == 0:
            return None
        return (target_close - base_close) / base_close * 100.0
