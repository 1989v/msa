"""YahooFinanceClient — adapter implementing MarketDataClientPort via yfinance."""
import time as time_module
from datetime import date
from decimal import Decimal

import structlog
import yfinance as yf

from src.domain.model.ohlcv import BarInterval, OhlcvBar
from src.domain.port.market_data_client_port import MarketDataClientPort

logger = structlog.get_logger(__name__)

_RATE_LIMIT_DELAY = 0.5  # seconds between requests


class YahooFinanceClient(MarketDataClientPort):
    """Fetches OHLCV data from Yahoo Finance using yfinance."""

    def fetch_ohlcv(self, ticker: str, start: date, end: date) -> list[OhlcvBar]:
        try:
            df = yf.download(
                ticker,
                start=start.isoformat(),
                end=end.isoformat(),
                auto_adjust=True,
                progress=False,
            )
            time_module.sleep(_RATE_LIMIT_DELAY)

            if df.empty:
                logger.warning("yfinance returned empty data", ticker=ticker)
                return []

            # Flatten MultiIndex columns if present (yfinance >= 0.2.40)
            if hasattr(df.columns, "levels"):
                df.columns = df.columns.get_level_values(0)

            bars: list[OhlcvBar] = []
            for trade_date, row in df.iterrows():
                try:
                    bar = OhlcvBar(
                        symbol_id=0,  # caller must set symbol_id
                        trade_date=trade_date.date() if hasattr(trade_date, "date") else trade_date,
                        open=Decimal(str(round(float(row["Open"]), 6))),
                        high=Decimal(str(round(float(row["High"]), 6))),
                        low=Decimal(str(round(float(row["Low"]), 6))),
                        close=Decimal(str(round(float(row["Close"]), 6))),
                        volume=int(row["Volume"]),
                    )
                    bars.append(bar)
                except (KeyError, ValueError) as e:
                    logger.warning("Skipping malformed bar", ticker=ticker, date=trade_date, error=str(e))

            logger.info("Fetched OHLCV from Yahoo Finance", ticker=ticker, bars=len(bars))
            return bars

        except Exception as e:
            logger.error("Failed to fetch OHLCV from Yahoo Finance", ticker=ticker, error=str(e))
            return []

    def fetch_intraday(self, ticker: str, interval: BarInterval = '5m') -> list[OhlcvBar]:
        try:
            df = yf.download(
                ticker,
                period='1d',
                interval=interval,
                auto_adjust=True,
                progress=False,
            )
            time_module.sleep(_RATE_LIMIT_DELAY)

            if df.empty:
                logger.warning("yfinance returned empty intraday data", ticker=ticker)
                return []

            if hasattr(df.columns, "levels"):
                df.columns = df.columns.get_level_values(0)

            bars: list[OhlcvBar] = []
            for ts, row in df.iterrows():
                try:
                    dt = ts.to_pydatetime() if hasattr(ts, 'to_pydatetime') else ts
                    bar = OhlcvBar(
                        symbol_id=0,
                        trade_date=dt.date(),
                        open=Decimal(str(round(float(row["Open"]), 6))),
                        high=Decimal(str(round(float(row["High"]), 6))),
                        low=Decimal(str(round(float(row["Low"]), 6))),
                        close=Decimal(str(round(float(row["Close"]), 6))),
                        volume=int(row["Volume"]),
                        interval=interval,
                        bar_time=dt.time().replace(second=0, microsecond=0),
                    )
                    bars.append(bar)
                except (KeyError, ValueError) as e:
                    logger.warning("Skipping malformed intraday bar", ticker=ticker, ts=ts, error=str(e))

            logger.info("Fetched intraday from Yahoo Finance", ticker=ticker, interval=interval, bars=len(bars))
            return bars

        except Exception as e:
            logger.error("Failed to fetch intraday from Yahoo Finance", ticker=ticker, error=str(e))
            return []
