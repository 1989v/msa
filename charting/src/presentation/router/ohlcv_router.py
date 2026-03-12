"""FastAPI router for OHLCV data retrieval."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from src.application.usecase.get_symbol_ohlcv_usecase import GetSymbolOhlcvUseCase
from src.config.dependencies import get_ohlcv_usecase
from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.presentation.dto.ohlcv_dto import OhlcvBarResponse

router = APIRouter(prefix="/api/v1", tags=["ohlcv"])


@router.get("/{ticker}/ohlcv", response_model=list[OhlcvBarResponse])
def get_ohlcv(
    ticker: str,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    use_case: GetSymbolOhlcvUseCase = Depends(get_ohlcv_usecase),
):
    try:
        bars = use_case.execute(ticker=ticker.upper(), start=start, end=end)
        return [
            OhlcvBarResponse(
                trade_date=b.trade_date,
                open=b.open,
                high=b.high,
                low=b.low,
                close=b.close,
                volume=b.volume,
            )
            for b in bars
        ]
    except InvalidSymbolError as e:
        raise HTTPException(status_code=404, detail=str(e))
