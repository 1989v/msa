"""API integration tests using FastAPI TestClient and in-memory mocks."""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.domain.model.embedding import Embedding
from src.domain.model.ohlcv import OhlcvBar
from src.domain.model.similarity_result import SimilarityResult
from src.domain.model.symbol import Symbol
from src.domain.policy.forecast_policy import ForecastStats
from src.main import create_app


@pytest.fixture
def client():
    app = create_app()
    # Override lifespan (no scheduler in tests)
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def noop_lifespan(app):
        yield

    app.router.lifespan_context = noop_lifespan
    return TestClient(app, raise_server_exceptions=True)


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_register_symbol(client):
    mock_symbol = Symbol(id=1, ticker="AAPL", name="Apple Inc.", market="US")
    with patch("src.presentation.router.symbol_router.get_register_symbol_usecase") as mock_dep:
        uc = MagicMock()
        uc.execute.return_value = mock_symbol
        mock_dep.return_value = uc

        resp = client.post(
            "/api/v1/symbols",
            json={"ticker": "AAPL", "name": "Apple Inc.", "market": "US"},
        )
    assert resp.status_code == 201
    assert resp.json()["ticker"] == "AAPL"


def test_similarity_not_found(client):
    from src.domain.exception.charting_exceptions import InvalidSymbolError

    with patch("src.presentation.router.similarity_router.get_search_usecase") as mock_dep:
        uc = MagicMock()
        uc.execute.side_effect = InvalidSymbolError("UNKNOWN")
        mock_dep.return_value = uc

        resp = client.post(
            "/api/v1/similarity",
            json={"ticker": "UNKNOWN"},
        )
    assert resp.status_code == 404


def test_similarity_success(client):
    mock_results = [
        SimilarityResult(
            pattern_id=1,
            ticker="MSFT",
            window_start=date(2020, 1, 1),
            window_end=date(2020, 3, 1),
            similarity=0.91,
            return_5d=Decimal("3.2"),
            return_20d=Decimal("7.8"),
            return_60d=None,
        )
    ]
    mock_forecast = ForecastStats(
        patterns=1,
        avg_return_5d=3.2,
        avg_return_20d=7.8,
        avg_return_60d=None,
        median_return_5d=3.2,
        median_return_20d=7.8,
        median_return_60d=None,
        positive_probability_5d=1.0,
        positive_probability_20d=1.0,
        positive_probability_60d=None,
    )

    with patch("src.presentation.router.similarity_router.get_search_usecase") as mock_dep:
        uc = MagicMock()
        uc.execute.return_value = (mock_results, mock_forecast)
        mock_dep.return_value = uc

        resp = client.post("/api/v1/similarity", json={"ticker": "AAPL"})

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["similar_patterns"]) == 1
    assert body["similar_patterns"][0]["ticker"] == "MSFT"
    assert body["forecast"]["patterns"] == 1
