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
    ("005930.KS", "Samsung Electronics"), ("000660.KS", "SK Hynix"),
    ("005380.KS", "Hyundai Motor"), ("035420.KS", "NAVER"),
    ("051910.KS", "LG Chem"), ("006400.KS", "Samsung SDI"),
    ("035720.KS", "Kakao"), ("003550.KS", "LG Corp."),
    ("028260.KS", "Samsung C&T"), ("012330.KS", "Hyundai Mobis"),
    ("068270.KS", "Celltrion"), ("096770.KS", "SK Innovation"),
    ("003490.KS", "Korean Air"), ("000270.KS", "Kia Corp."),
    ("105560.KS", "KB Financial Group"), ("055550.KS", "Shinhan Financial Group"),
    ("032830.KS", "Samsung Life Insurance"), ("086790.KS", "Hana Financial Group"),
    ("017670.KS", "SK Telecom"), ("030200.KS", "KT Corp."),
    ("009150.KS", "Samsung Electro-Mechanics"), ("018880.KS", "Hanon Systems"),
    ("034730.KS", "SK Inc."), ("011200.KS", "HMM"),
    ("023530.KS", "Lotte Shopping"), ("004020.KS", "Hyundai Steel"),
    ("161390.KS", "Hanwha Solutions"), ("000810.KS", "Samsung Fire & Marine Insurance"),
    ("010950.KS", "S-Oil"), ("015760.KS", "KEPCO"),
    ("247540.KQ", "Ecopro BM"), ("086520.KQ", "Ecopro"),
    ("196170.KQ", "Alteogen"), ("091990.KQ", "Celltrion Healthcare"),
    ("293490.KQ", "Kakao Games"), ("041510.KQ", "SM Entertainment"),
    ("352820.KQ", "HYBE"), ("112040.KQ", "Wemade"),
    ("067160.KQ", "AfreecaTV"), ("032640.KQ", "LG Uplus"),
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
