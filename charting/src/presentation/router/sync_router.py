"""FastAPI router for on-demand OHLCV sync with TTL-based freshness check."""
import time

from fastapi import APIRouter, Depends, HTTPException

from src.application.usecase.ingest_symbol_data_usecase import IngestSymbolDataUseCase
from src.config.dependencies import get_ingest_usecase
from src.domain.exception.charting_exceptions import InvalidSymbolError

router = APIRouter(prefix="/api/v1", tags=["sync"])

_DEFAULT_TTL_SECONDS = 4 * 60 * 60  # 4 hours
_last_sync: dict[str, float] = {}  # ticker -> epoch timestamp


@router.post("/{ticker}/sync")
def sync_ticker(
    ticker: str,
    force: bool = False,
    use_case: IngestSymbolDataUseCase = Depends(get_ingest_usecase),
):
    """Sync OHLCV data for a ticker. Skips if synced within TTL unless force=True."""
    ticker_upper = ticker.upper()
    now = time.time()
    last = _last_sync.get(ticker_upper, 0)

    if not force and (now - last) < _DEFAULT_TTL_SECONDS:
        remaining = int(_DEFAULT_TTL_SECONDS - (now - last))
        return {
            "ticker": ticker_upper,
            "synced": False,
            "reason": "fresh",
            "next_sync_in_seconds": remaining,
        }

    try:
        result = use_case.execute(ticker_upper)
        _last_sync[ticker_upper] = now
        return {
            "ticker": ticker_upper,
            "synced": True,
            "bars_ingested": result["bars_ingested"],
            "patterns_created": result["patterns_created"],
        }
    except InvalidSymbolError as e:
        raise HTTPException(status_code=404, detail=str(e))
