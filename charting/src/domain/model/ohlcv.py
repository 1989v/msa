"""Domain model — OhlcvBar. No framework imports."""
from dataclasses import dataclass
from datetime import date, time
from decimal import Decimal
from typing import Literal

BarInterval = Literal['1d', '5m']


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
    interval: BarInterval = '1d'
    bar_time: time = time(0, 0)

    def __post_init__(self) -> None:
        if self.high < self.low:
            raise ValueError(
                f"high ({self.high}) must be >= low ({self.low}) on {self.trade_date}."
            )
        if self.volume < 0:
            raise ValueError(f"volume must be non-negative, got {self.volume}.")
