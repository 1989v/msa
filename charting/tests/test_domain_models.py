"""Unit tests for domain models and policies — no external dependencies."""
import pytest
from datetime import date
from decimal import Decimal

from src.domain.exception.charting_exceptions import InsufficientDataError, InvalidSymbolError
from src.domain.model.embedding import Embedding, EMBEDDING_DIM
from src.domain.model.ohlcv import OhlcvBar
from src.domain.model.pattern import Pattern
from src.domain.model.similarity_result import SimilarityResult
from src.domain.model.symbol import Symbol
from src.domain.policy.forecast_policy import ForecastPolicy, ForecastStats


# --- Symbol ---

def test_symbol_valid():
    s = Symbol(ticker="AAPL", name="Apple Inc.", market="US")
    assert s.ticker == "AAPL"
    assert s.active is True


def test_symbol_invalid_market():
    with pytest.raises(ValueError, match="Unsupported market"):
        Symbol(ticker="AAPL", name="Apple Inc.", market="JP")


def test_symbol_empty_ticker():
    with pytest.raises(ValueError, match="ticker must not be empty"):
        Symbol(ticker="", name="Apple Inc.", market="US")


# --- Embedding ---

def test_embedding_correct_dim():
    e = Embedding(vector=[0.0] * EMBEDDING_DIM)
    assert len(e.vector) == EMBEDDING_DIM


def test_embedding_wrong_dim():
    with pytest.raises(ValueError, match="32 dimensions"):
        Embedding(vector=[0.0] * 10)


# --- OhlcvBar ---

def test_ohlcv_high_less_than_low_raises():
    with pytest.raises(ValueError, match="high"):
        OhlcvBar(
            symbol_id=1,
            trade_date=date(2024, 1, 1),
            open=Decimal("100"),
            high=Decimal("90"),  # high < low
            low=Decimal("95"),
            close=Decimal("92"),
            volume=1000,
        )


def test_ohlcv_negative_volume_raises():
    with pytest.raises(ValueError, match="volume"):
        OhlcvBar(
            symbol_id=1,
            trade_date=date(2024, 1, 1),
            open=Decimal("100"),
            high=Decimal("110"),
            low=Decimal("90"),
            close=Decimal("105"),
            volume=-1,
        )


# --- Pattern ---

def test_pattern_invalid_window():
    emb = Embedding(vector=[0.0] * EMBEDDING_DIM)
    with pytest.raises(ValueError, match="window_end"):
        Pattern(
            symbol_id=1,
            window_start=date(2024, 6, 1),
            window_end=date(2024, 1, 1),  # end before start
            embedding=emb,
        )


# --- ForecastPolicy ---

def _make_result(r5, r20, r60) -> SimilarityResult:
    return SimilarityResult(
        pattern_id=1,
        ticker="AAPL",
        window_start=date(2020, 1, 1),
        window_end=date(2020, 3, 1),
        similarity=0.9,
        return_5d=Decimal(str(r5)) if r5 is not None else None,
        return_20d=Decimal(str(r20)) if r20 is not None else None,
        return_60d=Decimal(str(r60)) if r60 is not None else None,
    )


def test_forecast_all_positive():
    policy = ForecastPolicy()
    results = [_make_result(2.0, 5.0, 10.0), _make_result(3.0, 7.0, 15.0)]
    stats = policy.compute(results)
    assert stats.patterns == 2
    assert stats.avg_return_20d == pytest.approx(6.0)
    assert stats.positive_probability_20d == pytest.approx(1.0)


def test_forecast_mixed_sign():
    policy = ForecastPolicy()
    results = [_make_result(2.0, 5.0, 10.0), _make_result(-1.0, -3.0, -8.0)]
    stats = policy.compute(results)
    assert stats.positive_probability_20d == pytest.approx(0.5)


def test_forecast_no_realized_returns():
    policy = ForecastPolicy()
    results = [_make_result(None, None, None)]
    stats = policy.compute(results)
    assert stats.avg_return_20d is None
    assert stats.positive_probability_20d is None


def test_forecast_empty_results():
    policy = ForecastPolicy()
    stats = policy.compute([])
    assert stats.patterns == 0
    assert stats.avg_return_5d is None


# --- Exception messages ---

def test_insufficient_data_error():
    err = InsufficientDataError("AAPL", available=30, required=60)
    assert "30" in str(err)
    assert "AAPL" in str(err)


def test_invalid_symbol_error():
    err = InvalidSymbolError("INVALID")
    assert "INVALID" in str(err)


from datetime import time as dt_time

def test_ohlcv_bar_with_interval_and_bar_time():
    bar = OhlcvBar(
        symbol_id=1,
        trade_date=date(2026, 3, 19),
        open=Decimal("100"), high=Decimal("110"),
        low=Decimal("95"), close=Decimal("105"),
        volume=1000,
        interval="5m",
        bar_time=dt_time(9, 30),
    )
    assert bar.interval == "5m"
    assert bar.bar_time == dt_time(9, 30)

def test_ohlcv_bar_defaults_to_daily():
    bar = OhlcvBar(
        symbol_id=1,
        trade_date=date(2026, 3, 19),
        open=Decimal("100"), high=Decimal("110"),
        low=Decimal("95"), close=Decimal("105"),
        volume=1000,
    )
    assert bar.interval == "1d"
    assert bar.bar_time == dt_time(0, 0)
