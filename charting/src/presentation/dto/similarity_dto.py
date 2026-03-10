"""Pydantic v2 DTOs for similarity search endpoint."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class SimilarityRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20, examples=["AAPL"])
    window_end_date: date | None = Field(
        default=None,
        description="End date of the 60-day query window. Defaults to the latest available date.",
    )
    top_k: int = Field(default=20, ge=1, le=100)


class SimilarPatternItem(BaseModel):
    pattern_id: int
    ticker: str
    start_date: date
    end_date: date
    similarity: float
    return_5d: Decimal | None
    return_20d: Decimal | None
    return_60d: Decimal | None


class ForecastResponse(BaseModel):
    patterns: int
    avg_return_5d: float | None
    avg_return_20d: float | None
    avg_return_60d: float | None
    median_return_5d: float | None
    median_return_20d: float | None
    median_return_60d: float | None
    positive_probability_5d: float | None
    positive_probability_20d: float | None
    positive_probability_60d: float | None


class SimilarityResponse(BaseModel):
    similar_patterns: list[SimilarPatternItem]
    forecast: ForecastResponse
