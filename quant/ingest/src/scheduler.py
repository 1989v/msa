"""ingest sidecar entrypoint.

K8s CronJob 이 본 모듈을 호출:
    python -m src.scheduler --mode=incremental --interval=1d

ADR-0033/0034.
Phase 1.5 — 자산 카탈로그 DB 화 (V20260507_001).
quant /api/v1/quant/assets 에서 active 자산을 fetch.
실패 시 DEFAULT_TARGETS fallback (오프라인 / 첫 부트스트랩 보호).
"""
from __future__ import annotations

import logging
import os
from typing import List, Tuple

import click
import requests

from src.sinks.clickhouse_sink import (
    insert_bars,
    insert_dart_corp_codes,
    insert_investor_flows,
)
from src.sources.dart_corp_src import fetch_dart_corp_codes
from src.sources.fdr_src import fetch_fdr
from src.sources.investor_flows_src import fetch_investor_flows
from src.sources.yfinance_src import fetch_yfinance, safe_lookback_days

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("quant-ingest")


# 자산 카탈로그 — Phase 1 시드.
# FE SymbolSearch 의 POPULAR_SYMBOLS 와 정합 유지 필요.
# 실제 운영에선 ConfigMap / DB 시드로 교체.
DEFAULT_TARGETS = [
    # (asset_code, asset_class, source)
    # 미국 주식 (yfinance → market_code=YAHOO)
    ("AAPL", "STOCK_US", "yfinance"),
    ("NVDA", "STOCK_US", "yfinance"),
    ("TSLA", "STOCK_US", "yfinance"),
    ("MSFT", "STOCK_US", "yfinance"),
    ("GOOGL", "STOCK_US", "yfinance"),
    ("META", "STOCK_US", "yfinance"),
    # 한국 주식 (FDR → market_code=FDR_KR)
    ("005930", "STOCK_KR", "fdr"),  # 삼성전자
    ("000660", "STOCK_KR", "fdr"),  # SK하이닉스
    ("035420", "STOCK_KR", "fdr"),  # NAVER
    ("035720", "STOCK_KR", "fdr"),  # 카카오
    ("005380", "STOCK_KR", "fdr"),  # 현대차
    ("207940", "STOCK_KR", "fdr"),  # 삼성바이오로직스
    # 코인 (yfinance USD pair → market_code=YAHOO)
    ("BTC-USD", "CRYPTO", "yfinance"),
    ("ETH-USD", "CRYPTO", "yfinance"),
]


def load_targets() -> List[Tuple[str, str, str]]:
    """quant 백엔드의 자산 카탈로그 fetch.

    `QUANT_API_URL` 미지정 시 in-cluster DNS `http://quant:8094` 사용.
    실패 시 DEFAULT_TARGETS 로 fallback (오프라인 / DB 미부트 케이스 보호).
    """
    base = os.environ.get("QUANT_API_URL", "http://quant:8094")
    url = f"{base}/api/v1/quant/assets?activeOnly=true"
    try:
        r = requests.get(url, timeout=5)
        r.raise_for_status()
        body = r.json()
        items = body.get("data") or body.get("payload") or []
        targets = [(d["assetCode"], d["assetClass"], d["source"]) for d in items]
        if not targets:
            log.warning("asset catalog returned empty, fallback DEFAULT_TARGETS")
            return DEFAULT_TARGETS
        log.info("loaded %d targets from quant catalog API", len(targets))
        return targets
    except Exception as exc:
        log.warning("failed to load asset catalog from %s: %s — fallback DEFAULT_TARGETS", url, exc)
        return DEFAULT_TARGETS


@click.command()
@click.option(
    "--job",
    type=click.Choice(["ohlcv", "investor-flows", "dart-corp-codes"]),
    default="ohlcv",
    help=(
        "Ingest job. 'ohlcv' (default) = OHLCV 시계열, "
        "'investor-flows' = ADR-0040 KR 매매주체 일별, "
        "'dart-corp-codes' = ADR-0041 DART corp_code 매핑 (주 1회)"
    ),
)
@click.option("--mode", type=click.Choice(["incremental", "backfill"]), default="incremental")
@click.option(
    "--interval",
    type=click.Choice(["1m", "5m", "15m", "30m", "1h", "1d", "1w", "1mo", "1y"]),
    default="1d",
    help="TimeframeKey — FE/quant TimeframeSelector 와 정합. "
    "yfinance 분봉(1m/5m/30m) 은 lookback 자동 한도 적용 (1m=7일, 5m/30m=60일).",
)
@click.option("--lookback-days", type=int, default=7)
def main(job: str, mode: str, interval: str, lookback_days: int) -> None:
    if job == "investor-flows":
        return _run_investor_flows(lookback_days)
    if job == "dart-corp-codes":
        return _run_dart_corp_codes()
    return _run_ohlcv(mode, interval, lookback_days)


def _run_dart_corp_codes() -> None:
    log.info("quant-ingest dart-corp-codes start")
    try:
        rows = list(fetch_dart_corp_codes())
        n = insert_dart_corp_codes(rows)
        log.info("quant-ingest dart-corp-codes done rows=%d", n)
    except Exception as exc:
        log.exception("dart-corp-codes ingest failed: %s", exc)


def _run_investor_flows(lookback_days: int) -> None:
    log.info("quant-ingest investor-flows start lookback_days=%d", lookback_days)
    targets = load_targets()
    total = 0
    for asset_code, asset_class, _source in targets:
        if asset_class != "STOCK_KR":
            continue  # KR 주식 전용
        try:
            flows = list(fetch_investor_flows(asset_code, lookback_days))
            n = insert_investor_flows(flows)
            total += n
            log.info("ingested investor-flows asset=%s rows=%d", asset_code, n)
        except Exception as exc:
            log.exception("investor-flows ingest failed asset=%s: %s", asset_code, exc)
    log.info("quant-ingest investor-flows done total_rows=%d", total)


def _run_ohlcv(mode: str, interval: str, lookback_days: int) -> None:
    # 분봉은 yfinance 한도 내로 lookback 자동 조정
    effective_lookback = safe_lookback_days(interval, lookback_days)
    if effective_lookback != lookback_days:
        log.info(
            "lookback_days clamped %d -> %d for interval=%s (yfinance limit)",
            lookback_days, effective_lookback, interval,
        )
    log.info(
        "quant-ingest start mode=%s interval=%s lookback_days=%d",
        mode, interval, effective_lookback,
    )
    targets = load_targets()
    total = 0
    for asset_code, asset_class, source in targets:
        try:
            if source == "yfinance":
                bars = list(fetch_yfinance(
                    asset_code=asset_code,
                    interval=interval,
                    lookback_days=effective_lookback,
                    asset_class=asset_class,
                ))
            elif source == "fdr":
                # FDR 은 KR 주식 일봉만 지원 — 분봉 요청 시 skip (분봉 KR 은 별도 source 필요)
                if interval not in ("1d", "1w", "1mo", "1y"):
                    log.info("skip fdr asset=%s — interval=%s 미지원 (daily only)", asset_code, interval)
                    continue
                bars = list(fetch_fdr(asset_code=asset_code, lookback_days=effective_lookback))
            else:
                log.warning("skip unknown source=%s for asset=%s", source, asset_code)
                continue
            n = insert_bars(bars)
            total += n
            log.info("ingested asset=%s rows=%d", asset_code, n)
        except Exception as exc:
            log.exception("ingest failed asset=%s: %s", asset_code, exc)
            # 한 자산 실패가 전체 중단으로 이어지지 않게 — Prometheus 메트릭은 후속 task
    log.info("quant-ingest done total_rows=%d", total)


if __name__ == "__main__":
    main()
