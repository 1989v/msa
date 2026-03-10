"""SearchSimilarPatternsUseCase — finds top-k similar patterns and computes forecast stats."""
from datetime import date

import structlog

from src.domain.exception.charting_exceptions import InsufficientDataError, InvalidSymbolError
from src.domain.model.similarity_result import SimilarityResult
from src.domain.policy.feature_extraction_policy import WINDOW_SIZE, FeatureExtractorPort
from src.domain.policy.forecast_policy import ForecastPolicy, ForecastStats
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort
from src.domain.port.pattern_repository_port import PatternRepositoryPort
from src.domain.port.symbol_repository_port import SymbolRepositoryPort

logger = structlog.get_logger(__name__)


class SearchSimilarPatternsUseCase:
    def __init__(
        self,
        symbol_repo: SymbolRepositoryPort,
        ohlcv_repo: OhlcvRepositoryPort,
        pattern_repo: PatternRepositoryPort,
        feature_extractor: FeatureExtractorPort,
        forecast_policy: ForecastPolicy,
    ) -> None:
        self._symbol_repo = symbol_repo
        self._ohlcv_repo = ohlcv_repo
        self._pattern_repo = pattern_repo
        self._feature_extractor = feature_extractor
        self._forecast_policy = forecast_policy

    def execute(
        self,
        ticker: str,
        window_end_date: date | None = None,
        top_k: int = 20,
    ) -> tuple[list[SimilarityResult], ForecastStats]:
        symbol = self._symbol_repo.find_by_ticker(ticker)
        if symbol is None:
            raise InvalidSymbolError(ticker)

        symbol_id = symbol.id
        if symbol_id is None:
            raise InvalidSymbolError(ticker)

        # Fetch the target window
        bars = self._ohlcv_repo.find_by_symbol(
            symbol_id,
            end=window_end_date,
        )

        if len(bars) < WINDOW_SIZE:
            raise InsufficientDataError(
                ticker=ticker,
                available=len(bars),
                required=WINDOW_SIZE,
            )

        # Use the most recent WINDOW_SIZE bars
        window = bars[-WINDOW_SIZE:]
        embedding = self._feature_extractor.extract(window)

        # Search similar patterns (exclude the queried symbol itself)
        similar = self._pattern_repo.search_similar(
            embedding=embedding,
            top_k=top_k,
            exclude_symbol_id=symbol_id,
        )

        forecast = self._forecast_policy.compute(similar)

        logger.info(
            "Similarity search complete",
            ticker=ticker,
            matches=len(similar),
        )
        return similar, forecast
