"""yfinance Ticker.info 기반 fundamentals 수집.

Yahoo v10 quoteSummary 는 crumb 인증을 요구해 quant 서비스에서 직접 호출이 불안정 —
yfinance Python 라이브러리는 cookie/crumb 처리를 자체적으로 한다. 본 sidecar 가
매일 한 번 fetch 해 ClickHouse `quant.fundamentals` 에 적재한다 (V011).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Optional

import yfinance as yf

log = logging.getLogger(__name__)


@dataclass
class FundamentalsRow:
    asset_code: str
    asset_class: str
    market_code: str
    as_of: date
    market_cap: Optional[float]
    pe_ratio: Optional[float]
    eps: Optional[float]
    dividend_yield: Optional[float]
    beta: Optional[float]
    weeks52_high: Optional[float]
    weeks52_low: Optional[float]
    avg_daily_volume: Optional[float]
    # V012 — 보유율 / 공매도 / 유통주식수
    held_pct_institutions: Optional[float] = None
    held_pct_insiders: Optional[float] = None
    short_ratio: Optional[float] = None
    float_shares: Optional[float] = None


def _to_yf_ticker(asset_code: str, asset_class: str) -> str:
    """asset_code → yfinance ticker. KR 은 .KS 우선 (KOSPI), .KQ 는 fallback."""
    if asset_class == "STOCK_KR":
        return f"{asset_code}.KS"
    return asset_code  # STOCK_US / CRYPTO 는 그대로


def _to_market_code(asset_class: str) -> str:
    """fundamentals 는 본 서비스의 MarketCode 와 정합 — KR 은 FDR_KR, 그 외 YAHOO."""
    if asset_class == "STOCK_KR":
        return "FDR_KR"
    return "YAHOO"


def _safe_float(v) -> Optional[float]:
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return f


def _safe_dict_get(d, key):
    """yfinance fast_info / info 양쪽 호환 — 둘 다 dict-like 이지만 KeyError/AttributeError 가능."""
    try:
        v = d[key] if hasattr(d, "__getitem__") else getattr(d, key, None)
    except (KeyError, AttributeError, TypeError):
        return None
    return v


def fetch_yfinance_fundamentals(
    asset_code: str, asset_class: str
) -> Optional[FundamentalsRow]:
    """yfinance fast_info (v8 chart, cookie 불필요) + .info (cookie/crumb) 결합.

    fast_info: 가격/시총/52W/볼륨 — 항상 동작. .info: PE/EPS/배당/베타 — cookie 인증
    실패 시 빈 dict 반환되므로 보조적으로만 활용. 한쪽만 성공해도 row 반환.
    KR 종목은 .KS 우선, .KQ 로 fallback.
    """
    candidates = [_to_yf_ticker(asset_code, asset_class)]
    if asset_class == "STOCK_KR":
        candidates.append(f"{asset_code}.KQ")

    for t in candidates:
        try:
            ticker_obj = yf.Ticker(t)
            fast = ticker_obj.fast_info  # cookie 불필요
        except Exception as e:  # noqa: BLE001
            log.debug("yfinance fast_info fail asset=%s ticker=%s err=%s", asset_code, t, e)
            continue

        last_price = _safe_float(_safe_dict_get(fast, "lastPrice")) \
            or _safe_float(_safe_dict_get(fast, "last_price"))
        if last_price is None:
            continue  # ticker 자체 invalid

        # .info (cookie 인증 필요) — 실패해도 fast_info 로 partial row 보장.
        info = {}
        try:
            info = ticker_obj.info or {}
        except Exception as e:  # noqa: BLE001
            log.debug("yfinance .info fail asset=%s ticker=%s err=%s (continuing with fast_info)", asset_code, t, e)

        return FundamentalsRow(
            asset_code=asset_code,
            asset_class=asset_class,
            market_code=_to_market_code(asset_class),
            as_of=date.today(),
            market_cap=_safe_float(info.get("marketCap")) or _safe_float(_safe_dict_get(fast, "marketCap")),
            pe_ratio=_safe_float(info.get("trailingPE")),
            eps=_safe_float(info.get("trailingEps")),
            dividend_yield=_safe_float(info.get("dividendYield")),
            beta=_safe_float(info.get("beta")),
            weeks52_high=_safe_float(info.get("fiftyTwoWeekHigh")) or _safe_float(_safe_dict_get(fast, "yearHigh")),
            weeks52_low=_safe_float(info.get("fiftyTwoWeekLow")) or _safe_float(_safe_dict_get(fast, "yearLow")),
            avg_daily_volume=_safe_float(info.get("averageDailyVolume3Month")) or _safe_float(_safe_dict_get(fast, "threeMonthAverageVolume")),
            held_pct_institutions=_safe_float(info.get("heldPercentInstitutions")),
            held_pct_insiders=_safe_float(info.get("heldPercentInsiders")),
            short_ratio=_safe_float(info.get("shortRatio")),
            float_shares=_safe_float(info.get("floatShares")),
        )
    return None
