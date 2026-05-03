"""ClickHouse `quant.ohlcv` 멱등 INSERT.

ADR-0033/0034 — 메인 서비스 read-only, 본 sidecar 가 단방향 적재.
"""
from __future__ import annotations

import os
from typing import Iterable

import clickhouse_connect

from src.sources.yfinance_src import OhlcvBar


def insert_bars(bars: Iterable[OhlcvBar]) -> int:
    """ReplacingMergeTree 이용 — `(asset_class, asset_code, market_code, interval, ts)` 동일 row 는 최신만 유지.

    Returns: insert 행 수.
    """
    rows = [
        (
            b.asset_code,
            b.asset_class,
            b.market_code,
            b.interval,
            b.ts,
            b.open, b.high, b.low, b.close, b.volume,
        )
        for b in bars
    ]
    if not rows:
        return 0

    client = clickhouse_connect.get_client(
        host=os.environ.get("CLICKHOUSE_HOST", "clickhouse"),
        port=int(os.environ.get("CLICKHOUSE_PORT", "8123")),
        database=os.environ.get("CLICKHOUSE_DB", "quant"),
        username=os.environ.get("CLICKHOUSE_USER", "default"),
        password=os.environ.get("CLICKHOUSE_PASSWORD", ""),
    )
    client.insert(
        "ohlcv",
        rows,
        column_names=[
            "asset_code", "asset_class", "market_code", "interval",
            "ts", "open", "high", "low", "close", "volume",
        ],
    )
    return len(rows)
