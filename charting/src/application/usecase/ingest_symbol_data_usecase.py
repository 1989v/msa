"""IngestSymbolDataUseCase — fetches OHLCV from external source and generates patterns."""
from datetime import date, timedelta

import structlog

from src.domain.exception.charting_exceptions import InsufficientDataError, InvalidSymbolError
from src.domain.model.pattern import Pattern
from src.domain.port.market_data_client_port import MarketDataClientPort
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort
from src.domain.port.pattern_repository_port import PatternRepositoryPort
from src.domain.port.symbol_repository_port import SymbolRepositoryPort
from src.domain.policy.feature_extraction_policy import WINDOW_SIZE, FeatureExtractorPort

logger = structlog.get_logger(__name__)

_DEFAULT_HISTORY_YEARS = 5


class IngestSymbolDataUseCase:
    def __init__(
        self,
        symbol_repo: SymbolRepositoryPort,
        ohlcv_repo: OhlcvRepositoryPort,
        pattern_repo: PatternRepositoryPort,
        market_client: MarketDataClientPort,
        feature_extractor: FeatureExtractorPort,
    ) -> None:
        self._symbol_repo = symbol_repo
        self._ohlcv_repo = ohlcv_repo
        self._pattern_repo = pattern_repo
        self._market_client = market_client
        self._feature_extractor = feature_extractor

    def execute(self, ticker: str, start: date | None = None) -> dict:
        symbol = self._symbol_repo.find_by_ticker(ticker)
        if symbol is None:
            raise InvalidSymbolError(ticker)

        symbol_id = symbol.id
        if symbol_id is None:
            raise InvalidSymbolError(ticker)

        # Determine fetch range
        latest = self._ohlcv_repo.find_latest_date(symbol_id)
        fetch_start = latest + timedelta(days=1) if latest else (
            start or (date.today() - timedelta(days=365 * _DEFAULT_HISTORY_YEARS))
        )
        fetch_end = date.today()

        if fetch_start > fetch_end:
            logger.info("OHLCV already up to date", ticker=ticker)
            return {"ticker": ticker, "bars_ingested": 0, "patterns_created": 0}

        # Fetch from external source
        raw_bars = self._market_client.fetch_ohlcv(ticker, fetch_start, fetch_end)
        for bar in raw_bars:
            bar.symbol_id = symbol_id

        bars_saved = self._ohlcv_repo.save_batch(raw_bars)
        logger.info("OHLCV ingested", ticker=ticker, bars=bars_saved)

        # Rebuild sliding window patterns
        all_bars = self._ohlcv_repo.find_by_symbol(symbol_id)
        patterns_created = self._generate_patterns(symbol_id, all_bars)

        return {
            "ticker": ticker,
            "bars_ingested": bars_saved,
            "patterns_created": patterns_created,
        }

    def _generate_patterns(self, symbol_id: int, all_bars: list) -> int:
        """Generate sliding window patterns (step=1) from all_bars."""
        if len(all_bars) < WINDOW_SIZE:
            return 0

        patterns: list[Pattern] = []
        for i in range(len(all_bars) - WINDOW_SIZE + 1):
            window = all_bars[i : i + WINDOW_SIZE]
            try:
                embedding = self._feature_extractor.extract(window)
                pattern = Pattern(
                    symbol_id=symbol_id,
                    window_start=window[0].trade_date,
                    window_end=window[-1].trade_date,
                    embedding=embedding,
                )
                patterns.append(pattern)
            except InsufficientDataError:
                continue

        saved = self._pattern_repo.save_batch(patterns)
        logger.info("Patterns generated", symbol_id=symbol_id, count=saved)
        return saved
