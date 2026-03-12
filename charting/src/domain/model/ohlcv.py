"""Domain model — OhlcvBar. No framework imports."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class OhlcvBar:
    symbol_id: int
    trade_date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    id: int | None = None

    def __post_init__(self) -> None:
        if self.high < self.low:
            raise ValueError(
                f"high ({self.high}) must be >= low ({self.low}) on {self.trade_date}."
            )
        if self.volume < 0:
            raise ValueError(f"volume must be non-negative, got {self.volume}.")
