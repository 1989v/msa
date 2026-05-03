"""ingest sidecar entrypoint.

K8s CronJob 이 본 모듈을 호출:
    python -m src.scheduler --mode=incremental --interval=1d

ADR-0033/0034.
"""
from __future__ import annotations

import logging
import os
import sys

import click

from src.sinks.clickhouse_sink import insert_bars
from src.sources.yfinance_src import fetch_yfinance

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("quant-ingest")


# 자산 카탈로그 — Phase 1 시드.
# 실제 운영에선 ConfigMap / DB 시드로 교체.
DEFAULT_TARGETS = [
    # (asset_code, asset_class, source)
    ("AAPL", "STOCK_US", "yfinance"),
    ("MSFT", "STOCK_US", "yfinance"),
    ("BTC-USD", "CRYPTO", "yfinance"),
    ("ETH-USD", "CRYPTO", "yfinance"),
]


@click.command()
@click.option("--mode", type=click.Choice(["incremental", "backfill"]), default="incremental")
@click.option("--interval", type=click.Choice(["1m", "5m", "15m", "1h", "1d"]), default="1d")
@click.option("--lookback-days", type=int, default=7)
def main(mode: str, interval: str, lookback_days: int) -> None:
    log.info("quant-ingest start mode=%s interval=%s lookback_days=%d", mode, interval, lookback_days)
    total = 0
    for asset_code, asset_class, source in DEFAULT_TARGETS:
        try:
            if source == "yfinance":
                bars = list(fetch_yfinance(
                    asset_code=asset_code,
                    interval=interval,
                    lookback_days=lookback_days,
                    asset_class=asset_class,
                ))
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
