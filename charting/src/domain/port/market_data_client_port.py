"""Port — external market data client abstraction. No framework imports."""
from abc import ABC, abstractmethod
from datetime import date

from src.domain.model.ohlcv import BarInterval, OhlcvBar


class MarketDataClientPort(ABC):
    """Fetches OHLCV data from an external data source."""

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

    @abstractmethod
    def fetch_intraday(
        self,
        ticker: str,
        interval: BarInterval = '5m',
    ) -> list[OhlcvBar]:
        """Fetch intraday OHLCV bars for the current/most recent trading day.
        Returns a list of OhlcvBar objects (symbol_id will be 0; caller must set it).
        Returns an empty list if no data is available.
        """
