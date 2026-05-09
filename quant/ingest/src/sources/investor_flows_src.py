"""ADR-0040 — KRX 매매주체 (외국인/기관/개인) 일별 ingest.

pykrx 의 `stock.get_market_trading_volume_by_date` 사용.
KR 주식 전용 — STOCK_KR / market_code=FDR_KR.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable

from pykrx import stock  # type: ignore


@dataclass
class InvestorFlowRow:
    asset_code: str
    market_code: str
    trade_date: datetime  # date-only, UTC midnight
    individual_net: int
    foreign_net: int
    institution_net: int


def fetch_investor_flows(
    asset_code: str,
    lookback_days: int = 30,
) -> Iterable[InvestorFlowRow]:
    """KRX 일별 매매주체 데이터 — `stock.get_market_trading_volume_by_date`.

    pykrx 가 반환하는 columns: 기관합계 / 기타법인 / 개인 / 외국인합계 / 전체.
    우리는 개인/외국인합계/기관합계 만 사용 (Int64).
    """
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=lookback_days)
    df = stock.get_market_trading_volume_by_date(
        start.strftime("%Y%m%d"),
        end.strftime("%Y%m%d"),
        asset_code,
    )
    if df is None or df.empty:
        return []
    # pykrx column 명은 한국어 라벨. 내부 키 매핑.
    cols = {c: c for c in df.columns}

    def col(*candidates: str) -> str | None:
        for c in candidates:
            if c in cols:
                return c
        return None

    individual_col = col("개인", "개인합계")
    foreign_col = col("외국인합계", "외국인")
    institution_col = col("기관합계", "기관")
    if not (individual_col and foreign_col and institution_col):
        # pykrx 스키마 변경 — skip 안전
        return []

    rows = []
    for ts, row in df.iterrows():
        try:
            d = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts
            d_utc = d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
            rows.append(
                InvestorFlowRow(
                    asset_code=asset_code,
                    market_code="FDR_KR",
                    trade_date=d_utc,
                    individual_net=int(row[individual_col]),
                    foreign_net=int(row[foreign_col]),
                    institution_net=int(row[institution_col]),
                )
            )
        except (KeyError, ValueError, TypeError):
            continue
    return rows
