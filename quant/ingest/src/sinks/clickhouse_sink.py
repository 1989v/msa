"""ClickHouse `quant.ohlcv` 멱등 INSERT.

ADR-0033/0034 — 메인 서비스 read-only, 본 sidecar 가 단방향 적재.
ADR-0040 — investor_flows 테이블에도 동일 패턴.
"""
from __future__ import annotations

import os
from typing import Iterable

import clickhouse_connect

from src.sources.yfinance_src import OhlcvBar
from src.sources.investor_flows_src import InvestorFlowRow
from src.sources.dart_corp_src import DartCorpCodeRow
from src.sources.yfinance_fundamentals_src import FundamentalsRow


def _client():
    return clickhouse_connect.get_client(
        host=os.environ.get("CLICKHOUSE_HOST", "clickhouse"),
        port=int(os.environ.get("CLICKHOUSE_PORT", "8123")),
        database=os.environ.get("CLICKHOUSE_DB", "quant"),
        username=os.environ.get("CLICKHOUSE_USER", "default"),
        password=os.environ.get("CLICKHOUSE_PASSWORD", ""),
    )


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

    client = _client()
    client.insert(
        "ohlcv",
        rows,
        column_names=[
            "asset_code", "asset_class", "market_code", "interval",
            "ts", "open", "high", "low", "close", "volume",
        ],
    )
    return len(rows)


def insert_dart_corp_codes(rows: Iterable[DartCorpCodeRow]) -> int:
    """ADR-0041 — dart_corp_codes 테이블 멱등 INSERT.

    Returns: insert 행 수.
    """
    data = [
        (
            r.corp_code,
            r.corp_name,
            r.stock_code,
            r.modify_date.date() if hasattr(r.modify_date, "date") else r.modify_date,
        )
        for r in rows
    ]
    if not data:
        return 0
    client = _client()
    client.insert(
        "dart_corp_codes",
        data,
        column_names=["corp_code", "corp_name", "stock_code", "modify_date"],
    )
    return len(data)


def insert_fundamentals(rows: Iterable[FundamentalsRow]) -> int:
    """V011/V012 — quant.fundamentals 멱등 INSERT (ReplacingMergeTree(ingested_at))."""
    data = [
        (
            r.asset_code,
            r.asset_class,
            r.market_code,
            r.as_of,
            r.market_cap,
            r.pe_ratio,
            r.eps,
            r.dividend_yield,
            r.beta,
            r.weeks52_high,
            r.weeks52_low,
            r.avg_daily_volume,
            r.held_pct_institutions,
            r.held_pct_insiders,
            r.short_ratio,
            r.float_shares,
        )
        for r in rows
    ]
    if not data:
        return 0
    client = _client()
    client.insert(
        "fundamentals",
        data,
        column_names=[
            "asset_code", "asset_class", "market_code", "as_of",
            "market_cap", "pe_ratio", "eps", "dividend_yield", "beta",
            "weeks52_high", "weeks52_low", "avg_daily_volume",
            "held_pct_institutions", "held_pct_insiders", "short_ratio", "float_shares",
        ],
    )
    return len(data)


def insert_investor_flows(flows: Iterable[InvestorFlowRow]) -> int:
    """ADR-0040 — investor_flows 테이블에 멱등 INSERT.

    Returns: insert 행 수.
    """
    rows = [
        (
            f.asset_code,
            f.market_code,
            f.trade_date.date() if hasattr(f.trade_date, "date") else f.trade_date,
            f.individual_net,
            f.foreign_net,
            f.institution_net,
        )
        for f in flows
    ]
    if not rows:
        return 0
    client = _client()
    client.insert(
        "investor_flows",
        rows,
        column_names=[
            "asset_code", "market_code", "trade_date",
            "individual_net", "foreign_net", "institution_net",
        ],
    )
    return len(rows)
