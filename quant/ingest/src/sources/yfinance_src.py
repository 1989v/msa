"""yfinance 기반 OHLCV 수집 (US 주식 + 일부 암호화폐).

ADR-0034 — Python ingest sidecar.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

import yfinance as yf


@dataclass
class OhlcvBar:
    asset_code: str
    asset_class: str
    market_code: str
    interval: str
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


def fetch_yfinance(
    asset_code: str,
    interval: str = "1d",
    lookback_days: int = 30,
    asset_class: str = "STOCK_US",
) -> Iterable[OhlcvBar]:
    """yfinance 로 [interval] 봉 [lookback_days] 일치를 가져온다."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=lookback_days)
    yf_interval = _to_yf_interval(interval)
    df = yf.download(
        tickers=asset_code,
        start=start.date(),
        end=end.date(),
        interval=yf_interval,
        progress=False,
        auto_adjust=False,
    )
    if df is None or df.empty:
        return []
    for ts, row in df.iterrows():
        # Multi-index columns 처리 (Adj Close 포함 / 단일 ticker)
        if hasattr(row.index, "nlevels") and row.index.nlevels > 1:
            o = float(row[("Open", asset_code)])
            h = float(row[("High", asset_code)])
            lo = float(row[("Low", asset_code)])
            c = float(row[("Close", asset_code)])
            v = float(row[("Volume", asset_code)])
        else:
            o = float(row["Open"])
            h = float(row["High"])
            lo = float(row["Low"])
            c = float(row["Close"])
            v = float(row["Volume"])
        yield OhlcvBar(
            asset_code=asset_code,
            asset_class=asset_class,
            market_code="YAHOO",
            interval=interval,
            ts=ts.to_pydatetime().replace(tzinfo=timezone.utc),
            open=o, high=h, low=lo, close=c, volume=v,
        )


def _to_yf_interval(interval: str) -> str:
    mapping = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "60m", "1d": "1d"}
    return mapping.get(interval, "1d")
