"""FinanceDataReader 기반 KR 주식 OHLCV 수집.

ADR-0034 — Python ingest sidecar.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

import FinanceDataReader as fdr  # type: ignore

from .yfinance_src import OhlcvBar


def fetch_fdr(asset_code: str, lookback_days: int = 30) -> Iterable[OhlcvBar]:
    """FDR 로 KR 주식 일봉 [lookback_days] 일치 수집."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=lookback_days)
    df = fdr.DataReader(asset_code, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    if df is None or df.empty:
        return []
    for ts, row in df.iterrows():
        yield OhlcvBar(
            asset_code=asset_code,
            asset_class="STOCK_KR",
            market_code="FDR_KR",
            interval="1d",
            ts=ts.to_pydatetime().replace(tzinfo=timezone.utc),
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            volume=float(row["Volume"]),
        )
