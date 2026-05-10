"""FinanceDataReader 기반 KR 주식 OHLCV 수집.

ADR-0034 — Python ingest sidecar.
fdr 자체는 daily 만 지원 → 1w/1mo/1y 는 pandas resample 로 OHLC aggregation.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

import FinanceDataReader as fdr  # type: ignore

from .yfinance_src import OhlcvBar


# pandas resample rule 매핑 — interval → offset alias.
# pandas 2.2+ 는 'M' deprecated → 'ME', 'Y' → 'YE'.
_RESAMPLE_RULE = {
    "1d": None,          # 원본 daily 그대로
    "1w": "W-FRI",       # 주봉 (금요일 마감 기준 — 미국 표준)
    "1mo": "ME",         # 월말
    "1y": "YE",          # 연말
}


def fetch_fdr(
    asset_code: str,
    lookback_days: int = 30,
    interval: str = "1d",
) -> Iterable[OhlcvBar]:
    """FDR 로 KR 주식 OHLCV 수집. interval=1d 외에는 daily 를 resample.

    1w/1mo/1y 호출 시 fdr daily → pandas OHLC resample → 해당 interval label 로 적재.
    """
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=lookback_days)
    df = fdr.DataReader(asset_code, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
    if df is None or df.empty:
        return []

    rule = _RESAMPLE_RULE.get(interval)
    if rule is not None:
        # OHLC resample — Open=first, High=max, Low=min, Close=last, Volume=sum.
        df = df.resample(rule).agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
        }).dropna()

    for ts, row in df.iterrows():
        yield OhlcvBar(
            asset_code=asset_code,
            asset_class="STOCK_KR",
            market_code="FDR_KR",
            interval=interval,
            ts=ts.to_pydatetime().replace(tzinfo=timezone.utc),
            open=float(row["Open"]),
            high=float(row["High"]),
            low=float(row["Low"]),
            close=float(row["Close"]),
            volume=float(row["Volume"]),
        )
