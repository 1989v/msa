"""FastAPI router for OHLCV data retrieval."""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from src.application.usecase.get_symbol_ohlcv_usecase import GetSymbolOhlcvUseCase
from src.application.usecase.sync_intraday_usecase import SyncIntradayUseCase
from src.config.dependencies import get_ohlcv_usecase, get_sync_intraday_usecase
from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.presentation.dto.ohlcv_dto import OhlcvBarResponse

router = APIRouter(prefix="/api/v1", tags=["ohlcv"])


@router.get("/{ticker}/ohlcv", response_model=list[OhlcvBarResponse])
def get_ohlcv(
    ticker: str,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    interval: Literal['1d', '5m'] = Query(default='1d'),
    use_case: GetSymbolOhlcvUseCase = Depends(get_ohlcv_usecase),
    sync_intraday: SyncIntradayUseCase = Depends(get_sync_intraday_usecase),
):
    try:
        upper_ticker = ticker.upper()

        if interval == '5m':
            sync_intraday.execute(upper_ticker, interval)

        bars = use_case.execute(ticker=upper_ticker, start=start, end=end, interval=interval)
        return [
            OhlcvBarResponse(
                trade_date=b.trade_date,
                open=b.open,
                high=b.high,
                low=b.low,
                close=b.close,
                volume=b.volume,
                bar_time=b.bar_time if interval != '1d' else None,
            )
            for b in bars
        ]
    except InvalidSymbolError as e:
        raise HTTPException(status_code=404, detail=str(e))
