"""Port — OHLCV persistence abstraction. No framework imports."""
from abc import ABC, abstractmethod
from datetime import date

from src.domain.model.ohlcv import OhlcvBar


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
    ) -> list[OhlcvBar]:
        """Return OHLCV bars for a symbol, optionally filtered by date range, ordered by trade_date ASC."""

    @abstractmethod
    def find_latest_date(self, symbol_id: int) -> date | None:
        """Return the most recent trade_date for the symbol, or None if no data."""
