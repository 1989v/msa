"""Seed script — register S&P 100 + KOSPI/KOSDAQ 50 symbols and trigger initial ingest.

Run once after `alembic upgrade head`:
    python -m src.config.seed_symbols
"""
import sys

import structlog

from src.adapter.persistence.symbol_repository import SymbolRepository
from src.application.usecase.ingest_symbol_data_usecase import IngestSymbolDataUseCase
from src.application.usecase.register_symbol_usecase import RegisterSymbolUseCase
from src.adapter.client.yahoo_finance_client import YahooFinanceClient
from src.adapter.computation.numpy_feature_extractor import NumpyFeatureExtractor
from src.adapter.persistence.ohlcv_repository import OhlcvRepository
from src.adapter.persistence.pattern_repository import PatternRepository
from src.config.database import get_session_factory

logger = structlog.get_logger(__name__)

# S&P 100 representative tickers (subset for MVP)
US_SYMBOLS = [
    ("AAPL", "Apple Inc."), ("MSFT", "Microsoft Corp."), ("AMZN", "Amazon.com Inc."),
    ("NVDA", "NVIDIA Corp."), ("GOOGL", "Alphabet Inc. Class A"), ("META", "Meta Platforms Inc."),
    ("TSLA", "Tesla Inc."), ("BRK-B", "Berkshire Hathaway Inc. Class B"), ("UNH", "UnitedHealth Group Inc."),
    ("XOM", "Exxon Mobil Corp."), ("JNJ", "Johnson & Johnson"), ("JPM", "JPMorgan Chase & Co."),
    ("V", "Visa Inc."), ("PG", "Procter & Gamble Co."), ("MA", "Mastercard Inc."),
    ("HD", "Home Depot Inc."), ("CVX", "Chevron Corp."), ("MRK", "Merck & Co. Inc."),
    ("ABBV", "AbbVie Inc."), ("PEP", "PepsiCo Inc."), ("KO", "Coca-Cola Co."),
    ("COST", "Costco Wholesale Corp."), ("AVGO", "Broadcom Inc."), ("WMT", "Walmart Inc."),
    ("BAC", "Bank of America Corp."), ("CRM", "Salesforce Inc."), ("TMO", "Thermo Fisher Scientific Inc."),
    ("NFLX", "Netflix Inc."), ("ACN", "Accenture plc"), ("LIN", "Linde plc"),
    ("MCD", "McDonald's Corp."), ("ABT", "Abbott Laboratories"), ("DHR", "Danaher Corp."),
    ("TXN", "Texas Instruments Inc."), ("ADBE", "Adobe Inc."), ("NKE", "Nike Inc."),
    ("NEE", "NextEra Energy Inc."), ("PM", "Philip Morris International Inc."),
    ("ORCL", "Oracle Corp."), ("RTX", "RTX Corp."), ("QCOM", "Qualcomm Inc."),
    ("HON", "Honeywell International Inc."), ("IBM", "IBM Corp."), ("GE", "GE Aerospace"),
    ("CAT", "Caterpillar Inc."), ("AMGN", "Amgen Inc."), ("SPGI", "S&P Global Inc."),
    ("INTC", "Intel Corp."), ("LOW", "Lowe's Companies Inc."), ("INTU", "Intuit Inc."),
]

# KOSPI/KOSDAQ representative tickers
KR_SYMBOLS = [
    ("005930.KS", "삼성전자"), ("000660.KS", "SK하이닉스"),
    ("005380.KS", "현대자동차"), ("035420.KS", "NAVER"),
    ("051910.KS", "LG화학"), ("006400.KS", "삼성SDI"),
    ("035720.KS", "카카오"), ("003550.KS", "LG"),
    ("028260.KS", "삼성물산"), ("012330.KS", "현대모비스"),
    ("068270.KS", "셀트리온"), ("096770.KS", "SK이노베이션"),
    ("003490.KS", "대한항공"), ("000270.KS", "기아"),
    ("105560.KS", "KB금융"), ("055550.KS", "신한지주"),
    ("032830.KS", "삼성생명"), ("086790.KS", "하나금융지주"),
    ("017670.KS", "SK텔레콤"), ("030200.KS", "KT"),
    ("009150.KS", "삼성전기"), ("018880.KS", "한온시스템"),
    ("034730.KS", "SK"), ("011200.KS", "HMM"),
    ("023530.KS", "롯데쇼핑"), ("004020.KS", "현대제철"),
    ("161390.KS", "한화솔루션"), ("000810.KS", "삼성화재"),
    ("010950.KS", "S-Oil"), ("015760.KS", "한국전력"),
    ("247540.KQ", "에코프로비엠"), ("086520.KQ", "에코프로"),
    ("196170.KQ", "알테오젠"), ("091990.KQ", "셀트리온헬스케어"),
    ("293490.KQ", "카카오게임즈"), ("041510.KQ", "SM"),
    ("352820.KQ", "하이브"), ("112040.KQ", "위메이드"),
    ("067160.KQ", "아프리카TV"), ("032640.KQ", "LG유플러스"),
]


def main():
    SessionLocal = get_session_factory()
    db = SessionLocal()

    try:
        register_uc = RegisterSymbolUseCase(symbol_repo=SymbolRepository(db))
        ingest_uc = IngestSymbolDataUseCase(
            symbol_repo=SymbolRepository(db),
            ohlcv_repo=OhlcvRepository(db),
            pattern_repo=PatternRepository(db),
            market_client=YahooFinanceClient(),
            feature_extractor=NumpyFeatureExtractor(),
        )

        all_symbols = [(t, n, "US") for t, n in US_SYMBOLS] + [(t, n, "KR") for t, n in KR_SYMBOLS]

        logger.info("Seeding symbols", total=len(all_symbols))
        for ticker, name, market in all_symbols:
            try:
                symbol = register_uc.execute(ticker=ticker, name=name, market=market)
                db.commit()
                logger.info("Registered", ticker=ticker, id=symbol.id)
            except Exception as e:
                db.rollback()
                logger.error("Registration failed", ticker=ticker, error=str(e))

        logger.info("Starting historical ingest (5y). This will take several minutes...")
        for ticker, name, market in all_symbols:
            try:
                result = ingest_uc.execute(ticker)
                db.commit()
                logger.info("Ingested", **result)
            except Exception as e:
                db.rollback()
                logger.error("Ingest failed", ticker=ticker, error=str(e))

        logger.info("Seed complete")
    finally:
        db.close()


if __name__ == "__main__":
    main()
