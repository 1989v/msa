"""Pydantic v2 DTOs for symbol endpoints."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RegisterSymbolRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20, examples=["AAPL"])
    name: str = Field(..., min_length=1, max_length=200, examples=["Apple Inc."])
    market: Literal["US", "KR"] = Field(..., examples=["US"])


class SymbolResponse(BaseModel):
    id: int
    ticker: str
    name: str
    market: str
    active: bool
    created_at: datetime | None = None
