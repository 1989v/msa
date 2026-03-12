"""Domain model — Symbol. No framework imports."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Symbol:
    ticker: str           # e.g. "AAPL", "005930.KS"
    name: str             # e.g. "Apple Inc."
    market: str           # "US" | "KR"
    active: bool = True
    id: int | None = None
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.market not in ("US", "KR"):
            raise ValueError(f"Unsupported market: {self.market!r}. Must be 'US' or 'KR'.")
        if not self.ticker:
            raise ValueError("ticker must not be empty.")
        if not self.name:
            raise ValueError("name must not be empty.")
