"""FastAPI router for symbol management."""
from fastapi import APIRouter, Depends, HTTPException, status

from src.application.usecase.ingest_symbol_data_usecase import IngestSymbolDataUseCase
from src.application.usecase.register_symbol_usecase import RegisterSymbolUseCase
from src.config.dependencies import get_ingest_usecase, get_register_symbol_usecase
from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.presentation.dto.symbol_dto import RegisterSymbolRequest, SymbolResponse

router = APIRouter(prefix="/api/v1/symbols", tags=["symbols"])


@router.get("", response_model=list[SymbolResponse])
def list_symbols(
    use_case: RegisterSymbolUseCase = Depends(get_register_symbol_usecase),
):
    symbols = use_case._symbol_repo.find_all_active()
    return [
        SymbolResponse(
            id=s.id,
            ticker=s.ticker,
            name=s.name,
            market=s.market,
            active=s.active,
            created_at=s.created_at,
        )
        for s in symbols
    ]


@router.post("", response_model=SymbolResponse, status_code=status.HTTP_201_CREATED)
def register_symbol(
    req: RegisterSymbolRequest,
    use_case: RegisterSymbolUseCase = Depends(get_register_symbol_usecase),
):
    symbol = use_case.execute(ticker=req.ticker, name=req.name, market=req.market)
    return SymbolResponse(
        id=symbol.id,
        ticker=symbol.ticker,
        name=symbol.name,
        market=symbol.market,
        active=symbol.active,
        created_at=symbol.created_at,
    )


@router.post("/{ticker}/ingest", status_code=status.HTTP_200_OK)
def trigger_ingest(
    ticker: str,
    use_case: IngestSymbolDataUseCase = Depends(get_ingest_usecase),
):
    """Manually trigger OHLCV ingest for a symbol (useful for testing)."""
    try:
        result = use_case.execute(ticker.upper())
        return result
    except InvalidSymbolError as e:
        raise HTTPException(status_code=404, detail=str(e))
