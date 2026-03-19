"""SyncIntradayUseCase — TTL-based intraday bar synchronization."""
from datetime import datetime, timedelta, timezone

import structlog

from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.domain.model.ohlcv import BarInterval
from src.domain.port.market_data_client_port import MarketDataClientPort
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort
from src.domain.port.symbol_repository_port import SymbolRepositoryPort

logger = structlog.get_logger(__name__)

_INTRADAY_TTL = timedelta(minutes=5)


class SyncIntradayUseCase:
    def __init__(
        self,
        symbol_repo: SymbolRepositoryPort,
        ohlcv_repo: OhlcvRepositoryPort,
        market_client: MarketDataClientPort,
    ) -> None:
        self._symbol_repo = symbol_repo
        self._ohlcv_repo = ohlcv_repo
        self._market_client = market_client

    def execute(self, ticker: str, interval: BarInterval = '5m') -> dict:
        symbol = self._symbol_repo.find_by_ticker(ticker)
        if symbol is None:
            raise InvalidSymbolError(ticker)

        symbol_id = symbol.id
        if symbol_id is None:
            raise InvalidSymbolError(ticker)

        latest = self._ohlcv_repo.find_latest_bar_time(symbol_id, interval)
        now = datetime.now(timezone.utc)
        if latest is not None:
            latest_utc = latest.replace(tzinfo=timezone.utc) if latest.tzinfo is None else latest
            if now - latest_utc < _INTRADAY_TTL:
                logger.info("Intraday TTL not expired", ticker=ticker, latest=latest)
                return {"synced": False, "reason": "TTL not expired"}

        bars = self._market_client.fetch_intraday(ticker, interval)
        if not bars:
            logger.warning("No intraday data returned", ticker=ticker)
            return {"synced": False, "reason": "No data available"}

        for b in bars:
            b.symbol_id = symbol_id

        count = self._ohlcv_repo.save_batch(bars)
        logger.info("Synced intraday bars", ticker=ticker, interval=interval, count=count)
        return {"synced": True, "bars_ingested": count}
