"""GetSymbolOhlcvUseCase — retrieves stored OHLCV bars for a symbol."""
from datetime import date

import structlog

from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.domain.model.ohlcv import BarInterval, OhlcvBar
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort
from src.domain.port.symbol_repository_port import SymbolRepositoryPort

logger = structlog.get_logger(__name__)


class GetSymbolOhlcvUseCase:
    def __init__(
        self,
        symbol_repo: SymbolRepositoryPort,
        ohlcv_repo: OhlcvRepositoryPort,
    ) -> None:
        self._symbol_repo = symbol_repo
        self._ohlcv_repo = ohlcv_repo

    def execute(
        self,
        ticker: str,
        start: date | None = None,
        end: date | None = None,
        interval: BarInterval = '1d',
    ) -> list[OhlcvBar]:
        symbol = self._symbol_repo.find_by_ticker(ticker)
        if symbol is None:
            raise InvalidSymbolError(ticker)

        symbol_id = symbol.id
        if symbol_id is None:
            raise InvalidSymbolError(ticker)

        bars = self._ohlcv_repo.find_by_symbol(symbol_id, start=start, end=end, interval=interval)
        logger.info("Retrieved OHLCV", ticker=ticker, interval=interval, bars=len(bars))
        return bars
