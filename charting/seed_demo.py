"""Quick demo seed: 5 symbols, 1 year of data."""
import sys
sys.path.insert(0, ".")

from datetime import date, timedelta

from src.adapter.client.yahoo_finance_client import YahooFinanceClient
from src.adapter.computation.numpy_feature_extractor import NumpyFeatureExtractor
from src.adapter.persistence.ohlcv_repository import OhlcvRepository
from src.adapter.persistence.pattern_repository import PatternRepository
from src.adapter.persistence.symbol_repository import SymbolRepository
from src.application.usecase.ingest_symbol_data_usecase import IngestSymbolDataUseCase
from src.application.usecase.register_symbol_usecase import RegisterSymbolUseCase
from src.config.database import get_session_factory

DEMO_SYMBOLS = [
    ("AAPL", "Apple Inc.", "US"),
    ("MSFT", "Microsoft Corp.", "US"),
    ("TSLA", "Tesla Inc.", "US"),
    ("NVDA", "NVIDIA Corp.", "US"),
    ("005930.KS", "Samsung Electronics", "KR"),
]

START = date.today() - timedelta(days=365)

SessionLocal = get_session_factory()
db = SessionLocal()

register_uc = RegisterSymbolUseCase(SymbolRepository(db))
ingest_uc = IngestSymbolDataUseCase(
    symbol_repo=SymbolRepository(db),
    ohlcv_repo=OhlcvRepository(db),
    pattern_repo=PatternRepository(db),
    market_client=YahooFinanceClient(),
    feature_extractor=NumpyFeatureExtractor(),
)

for ticker, name, market in DEMO_SYMBOLS:
    print(f"[{ticker}] Registering...", flush=True)
    sym = register_uc.execute(ticker, name, market)
    db.commit()
    print(f"[{ticker}] Ingesting...", flush=True)
    try:
        result = ingest_uc.execute(ticker, start=START)
        db.commit()
        print(f"[{ticker}] {result}", flush=True)
    except Exception as e:
        db.rollback()
        print(f"[{ticker}] ERROR: {e}", flush=True)

db.close()
print("Demo seed complete!")
