"""Port — OHLCV persistence abstraction. No framework imports."""
from abc import ABC, abstractmethod
from datetime import date, datetime

from src.domain.model.ohlcv import BarInterval, OhlcvBar


class OhlcvRepositoryPort(ABC):
    @abstractmethod
    def save_batch(self, bars: list[OhlcvBar]) -> int:
        """Upsert a batch of OHLCV bars. Returns the number of rows inserted/updated."""

    @abstractmethod
    def find_by_symbol(
        self,
        symbol_id: int,
        start: date | None = None,
        end: date | None = None,
        interval: BarInterval = '1d',
    ) -> list[OhlcvBar]:
        """Return OHLCV bars for a symbol, optionally filtered by date range, ordered by trade_date ASC."""

    @abstractmethod
    def find_latest_date(self, symbol_id: int) -> date | None:
        """Return the most recent trade_date for the symbol, or None if no data."""

    @abstractmethod
    def find_latest_bar_time(self, symbol_id: int, interval: BarInterval = '5m') -> datetime | None:
        """Return the most recent trade_date+bar_time as datetime for intraday bars, or None."""
