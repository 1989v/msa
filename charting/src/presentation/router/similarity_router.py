"""FastAPI router for similarity search."""
from fastapi import APIRouter, Depends, HTTPException

from src.application.usecase.search_similar_patterns_usecase import SearchSimilarPatternsUseCase
from src.config.dependencies import get_search_usecase
from src.domain.exception.charting_exceptions import InsufficientDataError, InvalidSymbolError
from src.presentation.dto.similarity_dto import (
    ForecastResponse,
    SimilarPatternItem,
    SimilarityRequest,
    SimilarityResponse,
)

router = APIRouter(prefix="/api/v1", tags=["similarity"])


@router.post("/similarity", response_model=SimilarityResponse)
def search_similarity(
    req: SimilarityRequest,
    use_case: SearchSimilarPatternsUseCase = Depends(get_search_usecase),
):
    try:
        similar_patterns, forecast = use_case.execute(
            ticker=req.ticker.upper(),
            window_end_date=req.window_end_date,
            top_k=req.top_k,
        )
    except InvalidSymbolError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InsufficientDataError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return SimilarityResponse(
        similar_patterns=[
            SimilarPatternItem(
                pattern_id=p.pattern_id,
                ticker=p.ticker,
                start_date=p.window_start,
                end_date=p.window_end,
                similarity=p.similarity,
                return_5d=p.return_5d,
                return_20d=p.return_20d,
                return_60d=p.return_60d,
            )
            for p in similar_patterns
        ],
        forecast=ForecastResponse(
            patterns=forecast.patterns,
            avg_return_5d=forecast.avg_return_5d,
            avg_return_20d=forecast.avg_return_20d,
            avg_return_60d=forecast.avg_return_60d,
            median_return_5d=forecast.median_return_5d,
            median_return_20d=forecast.median_return_20d,
            median_return_60d=forecast.median_return_60d,
            positive_probability_5d=forecast.positive_probability_5d,
            positive_probability_20d=forecast.positive_probability_20d,
            positive_probability_60d=forecast.positive_probability_60d,
        ),
    )
