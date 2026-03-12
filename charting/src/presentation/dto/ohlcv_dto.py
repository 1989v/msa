"""Pydantic v2 DTOs for OHLCV endpoints."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class OhlcvBarResponse(BaseModel):
    trade_date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
