"""Domain model — SimilarityResult. No framework imports."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class SimilarityResult:
    pattern_id: int
    ticker: str
    window_start: date
    window_end: date
    similarity: float        # cosine similarity, 0.0 ~ 1.0
    return_5d: Decimal | None
    return_20d: Decimal | None
    return_60d: Decimal | None
