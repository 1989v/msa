"""Port — external market data client abstraction. No framework imports."""
from abc import ABC, abstractmethod
from datetime import date

from src.domain.model.ohlcv import OhlcvBar


class MarketDataClientPort(ABC):
    """Fetches OHLCV data from an external data source (Yahoo Finance, FinanceDataReader, etc.)."""

    @abstractmethod
    def fetch_ohlcv(
        self,
        ticker: str,
        start: date,
        end: date,
    ) -> list[OhlcvBar]:
        """Fetch daily OHLCV bars for the given ticker in [start, end].

        Returns a list of OhlcvBar objects (symbol_id will be 0; caller must set it).
        Returns an empty list if no data is available.
        """
