"""Domain model — Pattern (60-day window + 32-dim embedding). No framework imports."""
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from src.domain.model.embedding import Embedding


@dataclass
class Pattern:
    symbol_id: int
    window_start: date
    window_end: date
    embedding: Embedding
    return_5d: Decimal | None = None   # NULL until realized (no lookahead bias)
    return_20d: Decimal | None = None
    return_60d: Decimal | None = None
    id: int | None = None
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        if self.window_end < self.window_start:
            raise ValueError(
                f"window_end ({self.window_end}) must be >= window_start ({self.window_start})."
            )
