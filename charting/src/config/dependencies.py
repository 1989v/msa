"""Dependency injection wiring for FastAPI."""
from functools import lru_cache

from fastapi import Depends
from sqlalchemy.orm import Session

from src.adapter.client.finance_data_reader_client import FinanceDataReaderClient
from src.adapter.client.yahoo_finance_client import YahooFinanceClient
from src.adapter.computation.numpy_feature_extractor import NumpyFeatureExtractor
from src.adapter.persistence.ohlcv_repository import OhlcvRepository
from src.adapter.persistence.pattern_repository import PatternRepository
from src.adapter.persistence.symbol_repository import SymbolRepository
from src.application.usecase.get_symbol_ohlcv_usecase import GetSymbolOhlcvUseCase
from src.application.usecase.ingest_symbol_data_usecase import IngestSymbolDataUseCase
from src.application.usecase.register_symbol_usecase import RegisterSymbolUseCase
from src.application.usecase.search_similar_patterns_usecase import SearchSimilarPatternsUseCase
from src.config.database import get_db
from src.domain.policy.forecast_policy import ForecastPolicy


@lru_cache
def _get_feature_extractor() -> NumpyFeatureExtractor:
    return NumpyFeatureExtractor()


@lru_cache
def _get_forecast_policy() -> ForecastPolicy:
    return ForecastPolicy()


def _get_yahoo_client() -> YahooFinanceClient:
    return YahooFinanceClient()


def get_register_symbol_usecase(
    db: Session = Depends(get_db),
) -> RegisterSymbolUseCase:
    return RegisterSymbolUseCase(symbol_repo=SymbolRepository(db))


def get_ingest_usecase(
    db: Session = Depends(get_db),
) -> IngestSymbolDataUseCase:
    return IngestSymbolDataUseCase(
        symbol_repo=SymbolRepository(db),
        ohlcv_repo=OhlcvRepository(db),
        pattern_repo=PatternRepository(db),
        market_client=YahooFinanceClient(),
        feature_extractor=_get_feature_extractor(),
    )


def get_search_usecase(
    db: Session = Depends(get_db),
) -> SearchSimilarPatternsUseCase:
    return SearchSimilarPatternsUseCase(
        symbol_repo=SymbolRepository(db),
        ohlcv_repo=OhlcvRepository(db),
        pattern_repo=PatternRepository(db),
        feature_extractor=_get_feature_extractor(),
        forecast_policy=_get_forecast_policy(),
    )


def get_ohlcv_usecase(
    db: Session = Depends(get_db),
) -> GetSymbolOhlcvUseCase:
    return GetSymbolOhlcvUseCase(
        symbol_repo=SymbolRepository(db),
        ohlcv_repo=OhlcvRepository(db),
    )
