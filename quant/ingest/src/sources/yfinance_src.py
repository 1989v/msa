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
    """우리 TimeframeKey → yfinance interval 매핑.

    yfinance 가 직접 지원: 1m / 5m / 15m / 30m / 60m / 1d / 1wk / 1mo / 3mo.
    1y 는 미지원 → 1mo 로 fallback (12개 = 1년 근사).
    """
    mapping = {
        "1m": "1m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "60m",
        "1d": "1d",
        "1w": "1wk",
        "1mo": "1mo",
        "1y": "1mo",  # yfinance 1y interval 미지원
    }
    return mapping.get(interval, "1d")


# yfinance 의 interval 별 lookback 한도 (일).
# 분봉은 7일 (1m) / 60일 (5m/15m/30m), 그 외는 충분.
INTERVAL_MAX_LOOKBACK_DAYS = {
    "1m": 7,
    "5m": 60,
    "15m": 60,
    "30m": 60,
    "1h": 730,
    "1d": 365 * 5,
    "1w": 365 * 20,
    "1mo": 365 * 50,
    "1y": 365 * 50,
}


def safe_lookback_days(interval: str, requested: int) -> int:
    """yfinance 한도 내로 lookback 을 조정."""
    cap = INTERVAL_MAX_LOOKBACK_DAYS.get(interval, 365)
    return min(requested, cap)
