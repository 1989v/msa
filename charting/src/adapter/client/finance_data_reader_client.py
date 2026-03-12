"""FinanceDataReaderClient — adapter implementing MarketDataClientPort via FinanceDataReader.

Used as fallback for Korean stocks when yfinance data is incomplete.
"""
from datetime import date
from decimal import Decimal

import FinanceDataReader as fdr
import structlog

from src.domain.model.ohlcv import OhlcvBar
from src.domain.port.market_data_client_port import MarketDataClientPort

logger = structlog.get_logger(__name__)


class FinanceDataReaderClient(MarketDataClientPort):
    """Fetches OHLCV data using FinanceDataReader (KRX/KOSPI/KOSDAQ)."""

    def fetch_ohlcv(self, ticker: str, start: date, end: date) -> list[OhlcvBar]:
        # FDR uses 6-digit KRX codes (e.g. "005930") rather than "005930.KS"
        fdr_ticker = ticker.replace(".KS", "").replace(".KQ", "")

        try:
            df = fdr.DataReader(
                fdr_ticker,
                start=start.isoformat(),
                end=end.isoformat(),
            )

            if df is None or df.empty:
                logger.warning("FinanceDataReader returned empty data", ticker=ticker)
                return []

            bars: list[OhlcvBar] = []
            for trade_date, row in df.iterrows():
                try:
                    close_col = "Close" if "Close" in row else "Adj Close"
                    bar = OhlcvBar(
                        symbol_id=0,  # caller must set symbol_id
                        trade_date=trade_date.date() if hasattr(trade_date, "date") else trade_date,
                        open=Decimal(str(round(float(row["Open"]), 6))),
                        high=Decimal(str(round(float(row["High"]), 6))),
                        low=Decimal(str(round(float(row["Low"]), 6))),
                        close=Decimal(str(round(float(row[close_col]), 6))),
                        volume=int(row["Volume"]),
                    )
                    bars.append(bar)
                except (KeyError, ValueError) as e:
                    logger.warning("Skipping malformed bar", ticker=ticker, date=trade_date, error=str(e))

            logger.info("Fetched OHLCV from FinanceDataReader", ticker=ticker, bars=len(bars))
            return bars

        except Exception as e:
            logger.error("Failed to fetch OHLCV from FinanceDataReader", ticker=ticker, error=str(e))
            return []
