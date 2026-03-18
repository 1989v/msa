# Chart Period Selection & Smart Pattern Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add period-based chart viewing (1D/1W/1M/3M/1Y/5Y) with candle aggregation, intraday 5m bar support, and interactive pattern overlay that auto-positions at the most similar chart segment with drag/scale capabilities.

**Architecture:** Backend adds `interval`/`bar_time` columns to `ohlcv_bars` table and a new `SyncIntradayUseCase` for 5m bar fetching via yfinance. Frontend adds period selector UI, weekly/monthly aggregation functions, and rewrites the pattern overlay system to use sliding-window best-match positioning with drag and scale interaction layers.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 2.0 / Alembic / yfinance / PostgreSQL + pgvector / React 18 / TypeScript / lightweight-charts 4.2 / TanStack React Query

**Spec:** `docs/superpowers/specs/2026-03-19-chart-period-pattern-overlay-design.md`

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `alembic/versions/0002_add_intraday_support.py` | Migration: add interval, bar_time columns + new unique constraint |
| `src/application/usecase/sync_intraday_usecase.py` | TTL-based 5m bar sync orchestration |

### Backend — Modified Files
| File | Changes |
|------|---------|
| `src/domain/model/ohlcv.py` | Add `interval` (Literal), `bar_time` (time) fields |
| `src/domain/port/ohlcv_repository_port.py` | Add `interval` param to `find_by_symbol()`, add `find_latest_bar_time()` |
| `src/domain/port/market_data_client_port.py` | Add `fetch_intraday()` method |
| `src/adapter/persistence/orm.py` | Add `interval`, `bar_time` columns to OhlcvBarOrm |
| `src/adapter/persistence/ohlcv_repository.py` | Update upsert index_elements, add interval filter, implement `find_latest_bar_time()` |
| `src/adapter/client/yahoo_finance_client.py` | Implement `fetch_intraday()` |
| `src/adapter/client/finance_data_reader_client.py` | Add `fetch_intraday()` stub (returns empty list) |
| `src/application/usecase/get_symbol_ohlcv_usecase.py` | Pass `interval` param through |
| `src/presentation/router/ohlcv_router.py` | Add `interval` query param, auto-sync for 5m |
| `src/presentation/dto/ohlcv_dto.py` | Add `bar_time` field |
| `src/config/dependencies.py` | Wire `SyncIntradayUseCase` |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/components/PeriodSelector.tsx` | Period button group (1D/1W/1M/3M/1Y/5Y) |
| `frontend/src/lib/aggregation.ts` | Weekly/monthly candle aggregation functions |

### Frontend — Modified Files
| File | Changes |
|------|---------|
| `frontend/src/api.ts` | Add `interval` param to `fetchOhlcv`, add `bar_time` to `OhlcvBar` |
| `frontend/src/lib/patternMatcher.ts` | Add `findBestMatchOffset()` sliding window function |
| `frontend/src/components/PatternChart.tsx` | Smart overlay positioning, drag interaction, scale adjustment |
| `frontend/src/App.tsx` | Period state, displayBars derivation, PeriodSelector wiring, pattern state reset |

---

## Task 1: Backend — Domain Model + Port Changes

**Files:**
- Modify: `src/domain/model/ohlcv.py:1-25`
- Modify: `src/domain/port/ohlcv_repository_port.py:1-25`
- Modify: `src/domain/port/market_data_client_port.py:1-23`
- Test: `tests/test_domain_models.py`

- [ ] **Step 1: Write failing test for OhlcvBar interval/bar_time fields**

In `tests/test_domain_models.py`, add:

```python
from datetime import time

def test_ohlcv_bar_with_interval_and_bar_time():
    bar = OhlcvBar(
        symbol_id=1,
        trade_date=date(2026, 3, 19),
        open=Decimal("100"), high=Decimal("110"),
        low=Decimal("95"), close=Decimal("105"),
        volume=1000,
        interval="5m",
        bar_time=time(9, 30),
    )
    assert bar.interval == "5m"
    assert bar.bar_time == time(9, 30)

def test_ohlcv_bar_defaults_to_daily():
    bar = OhlcvBar(
        symbol_id=1,
        trade_date=date(2026, 3, 19),
        open=Decimal("100"), high=Decimal("110"),
        low=Decimal("95"), close=Decimal("105"),
        volume=1000,
    )
    assert bar.interval == "1d"
    assert bar.bar_time == time(0, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting && python -m pytest tests/test_domain_models.py::test_ohlcv_bar_with_interval_and_bar_time -v`
Expected: FAIL — `TypeError: unexpected keyword argument 'interval'`

- [ ] **Step 3: Implement domain model changes**

In `src/domain/model/ohlcv.py`, replace entire file:

```python
"""Domain model — OhlcvBar. No framework imports."""
from dataclasses import dataclass
from datetime import date, time
from decimal import Decimal
from typing import Literal

BarInterval = Literal['1d', '5m']


@dataclass
class OhlcvBar:
    symbol_id: int
    trade_date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    id: int | None = None
    interval: BarInterval = '1d'
    bar_time: time = time(0, 0)

    def __post_init__(self) -> None:
        if self.high < self.low:
            raise ValueError(
                f"high ({self.high}) must be >= low ({self.low}) on {self.trade_date}."
            )
        if self.volume < 0:
            raise ValueError(f"volume must be non-negative, got {self.volume}.")
```

- [ ] **Step 4: Update OhlcvRepositoryPort**

In `src/domain/port/ohlcv_repository_port.py`, replace entire file:

```python
"""Port — OHLCV persistence abstraction. No framework imports."""
from abc import ABC, abstractmethod
from datetime import date, datetime

from src.domain.model.ohlcv import BarInterval, OhlcvBar


class OhlcvRepositoryPort(ABC):
    @abstractmethod
    def save_batch(self, bars: list[OhlcvBar]) -> int:
        """Upsert a batch of OHLCV bars. Returns the number of rows inserted/updated."""

    @abstractmethod
    def find_by_symbol(
        self,
        symbol_id: int,
        start: date | None = None,
        end: date | None = None,
        interval: BarInterval = '1d',
    ) -> list[OhlcvBar]:
        """Return OHLCV bars for a symbol, optionally filtered by date range, ordered by trade_date ASC."""

    @abstractmethod
    def find_latest_date(self, symbol_id: int) -> date | None:
        """Return the most recent trade_date for the symbol, or None if no data."""

    @abstractmethod
    def find_latest_bar_time(self, symbol_id: int, interval: BarInterval = '5m') -> datetime | None:
        """Return the most recent trade_date+bar_time as datetime for intraday bars, or None."""
```

- [ ] **Step 5: Update MarketDataClientPort**

In `src/domain/port/market_data_client_port.py`, replace entire file:

```python
"""Port — external market data client abstraction. No framework imports."""
from abc import ABC, abstractmethod
from datetime import date

from src.domain.model.ohlcv import BarInterval, OhlcvBar


class MarketDataClientPort(ABC):
    """Fetches OHLCV data from an external data source (Yahoo Finance, FinanceDataReader, etc.)."""

    @abstractmethod
    def fetch_ohlcv(
        self,
        ticker: str,
        start: date,
        end: date,
    ) -> list[OhlcvBar]:
        """Fetch daily OHLCV bars for the given ticker in [start, end].

        Returns a list of OhlcvBar objects (symbol_id will be 0; caller must set it).
        Returns an empty list if no data is available.
        """

    @abstractmethod
    def fetch_intraday(
        self,
        ticker: str,
        interval: BarInterval = '5m',
    ) -> list[OhlcvBar]:
        """Fetch intraday OHLCV bars for the current/most recent trading day.

        Returns a list of OhlcvBar objects (symbol_id will be 0; caller must set it).
        Returns an empty list if no data is available.
        """
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting && python -m pytest tests/test_domain_models.py -v`
Expected: ALL PASS (existing tests must still pass since new fields have defaults)

- [ ] **Step 7: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add src/domain/ tests/test_domain_models.py
git commit -m "feat(charting): add interval/bar_time to OhlcvBar domain model and ports"
```

---

## Task 2: Backend — Alembic Migration

**Files:**
- Create: `alembic/versions/0002_add_intraday_support.py`
- Modify: `src/adapter/persistence/orm.py:39-55`

- [ ] **Step 1: Update ORM model**

In `src/adapter/persistence/orm.py`, replace the `OhlcvBarOrm` class (lines 39-54):

```python
class OhlcvBarOrm(Base):
    __tablename__ = "ohlcv_bars"
    __table_args__ = (
        UniqueConstraint("symbol_id", "trade_date", "interval", "bar_time"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    symbol_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("symbols.id"), nullable=False
    )
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False)
    interval: Mapped[str] = mapped_column(String(5), nullable=False, server_default="1d")
    bar_time: Mapped[time] = mapped_column(Time, nullable=False, server_default=text("'00:00:00'"))

    symbol: Mapped["SymbolOrm"] = relationship(back_populates="ohlcv_bars")
```

Note: Add `Time` and `text` to the sqlalchemy imports at the top of orm.py. The `time` type import from `datetime` is already present at line 2.

- [ ] **Step 2: Create migration file**

Create `alembic/versions/0002_add_intraday_support.py`:

```python
"""Add interval and bar_time columns to ohlcv_bars for intraday support

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add interval column with default '1d'
    op.add_column(
        "ohlcv_bars",
        sa.Column("interval", sa.String(5), nullable=False, server_default="1d"),
    )
    # Add bar_time column with default '00:00:00'
    op.add_column(
        "ohlcv_bars",
        sa.Column("bar_time", sa.Time(), nullable=False, server_default=sa.text("'00:00:00'")),
    )

    # Drop old unique constraint and create new one
    op.drop_constraint("ohlcv_bars_symbol_id_trade_date_key", "ohlcv_bars", type_="unique")
    op.create_unique_constraint(
        "uq_ohlcv_bars_symbol_date_interval_time",
        "ohlcv_bars",
        ["symbol_id", "trade_date", "interval", "bar_time"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_ohlcv_bars_symbol_date_interval_time", "ohlcv_bars", type_="unique")
    op.drop_column("ohlcv_bars", "bar_time")
    op.drop_column("ohlcv_bars", "interval")
    op.create_unique_constraint(
        "ohlcv_bars_symbol_id_trade_date_key",
        "ohlcv_bars",
        ["symbol_id", "trade_date"],
    )
```

- [ ] **Step 3: Run migration**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting && alembic upgrade head`
Expected: Migration 0002 applied successfully.

- [ ] **Step 4: Verify migration**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting && alembic current`
Expected: Shows `0002 (head)`

- [ ] **Step 5: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add alembic/versions/0002_add_intraday_support.py src/adapter/persistence/orm.py
git commit -m "feat(charting): add interval/bar_time columns via migration 0002"
```

---

## Task 3: Backend — Repository + Client Adapter Updates

**Files:**
- Modify: `src/adapter/persistence/ohlcv_repository.py:1-84`
- Modify: `src/adapter/client/yahoo_finance_client.py:1-61`
- Test: `tests/test_domain_models.py` (add repo-level checks)

- [ ] **Step 1: Update OhlcvRepository**

Replace `src/adapter/persistence/ohlcv_repository.py`:

```python
"""SQLAlchemy implementation of OhlcvRepositoryPort."""
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import func, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from src.adapter.persistence.orm import OhlcvBarOrm
from src.domain.model.ohlcv import BarInterval, OhlcvBar
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort


class OhlcvRepository(OhlcvRepositoryPort):
    def __init__(self, session: Session) -> None:
        self._session = session

    def save_batch(self, bars: list[OhlcvBar]) -> int:
        if not bars:
            return 0
        rows = [
            {
                "symbol_id": b.symbol_id,
                "trade_date": b.trade_date,
                "open": float(b.open),
                "high": float(b.high),
                "low": float(b.low),
                "close": float(b.close),
                "volume": b.volume,
                "interval": b.interval,
                "bar_time": b.bar_time,
            }
            for b in bars
        ]
        stmt = (
            insert(OhlcvBarOrm)
            .values(rows)
            .on_conflict_do_update(
                index_elements=["symbol_id", "trade_date", "interval", "bar_time"],
                set_={
                    "open": text("EXCLUDED.open"),
                    "high": text("EXCLUDED.high"),
                    "low": text("EXCLUDED.low"),
                    "close": text("EXCLUDED.close"),
                    "volume": text("EXCLUDED.volume"),
                },
            )
        )
        result = self._session.execute(stmt)
        return result.rowcount

    def find_by_symbol(
        self,
        symbol_id: int,
        start: date | None = None,
        end: date | None = None,
        interval: BarInterval = '1d',
    ) -> list[OhlcvBar]:
        query = self._session.query(OhlcvBarOrm).filter(
            OhlcvBarOrm.symbol_id == symbol_id,
            OhlcvBarOrm.interval == interval,
        )
        if start:
            query = query.filter(OhlcvBarOrm.trade_date >= start)
        if end:
            query = query.filter(OhlcvBarOrm.trade_date <= end)
        rows = query.order_by(OhlcvBarOrm.trade_date.asc(), OhlcvBarOrm.bar_time.asc()).all()
        return [self._to_domain(r) for r in rows]

    def find_latest_date(self, symbol_id: int) -> date | None:
        result = self._session.query(func.max(OhlcvBarOrm.trade_date)).filter(
            OhlcvBarOrm.symbol_id == symbol_id,
            OhlcvBarOrm.interval == '1d',
        ).scalar()
        return result

    def find_latest_bar_time(self, symbol_id: int, interval: BarInterval = '5m') -> datetime | None:
        row = (
            self._session.query(OhlcvBarOrm.trade_date, OhlcvBarOrm.bar_time)
            .filter(OhlcvBarOrm.symbol_id == symbol_id, OhlcvBarOrm.interval == interval)
            .order_by(OhlcvBarOrm.trade_date.desc(), OhlcvBarOrm.bar_time.desc())
            .first()
        )
        if row is None:
            return None
        return datetime.combine(row.trade_date, row.bar_time)

    @staticmethod
    def _to_domain(orm: OhlcvBarOrm) -> OhlcvBar:
        return OhlcvBar(
            id=orm.id,
            symbol_id=orm.symbol_id,
            trade_date=orm.trade_date,
            open=Decimal(str(orm.open)),
            high=Decimal(str(orm.high)),
            low=Decimal(str(orm.low)),
            close=Decimal(str(orm.close)),
            volume=orm.volume,
            interval=orm.interval,
            bar_time=orm.bar_time if orm.bar_time else time(0, 0),
        )
```

- [ ] **Step 2: Update YahooFinanceClient with fetch_intraday**

In `src/adapter/client/yahoo_finance_client.py`, add `fetch_intraday` method after the existing `fetch_ohlcv` method (after line 60):

```python
    def fetch_intraday(self, ticker: str, interval: BarInterval = '5m') -> list[OhlcvBar]:
        try:
            df = yf.download(
                ticker,
                period='1d',
                interval=interval,
                auto_adjust=True,
                progress=False,
            )
            time_module.sleep(_RATE_LIMIT_DELAY)

            if df.empty:
                logger.warning("yfinance returned empty intraday data", ticker=ticker)
                return []

            if hasattr(df.columns, "levels"):
                df.columns = df.columns.get_level_values(0)

            bars: list[OhlcvBar] = []
            for ts, row in df.iterrows():
                try:
                    dt = ts.to_pydatetime() if hasattr(ts, 'to_pydatetime') else ts
                    bar = OhlcvBar(
                        symbol_id=0,
                        trade_date=dt.date(),
                        open=Decimal(str(round(float(row["Open"]), 6))),
                        high=Decimal(str(round(float(row["High"]), 6))),
                        low=Decimal(str(round(float(row["Low"]), 6))),
                        close=Decimal(str(round(float(row["Close"]), 6))),
                        volume=int(row["Volume"]),
                        interval=interval,
                        bar_time=dt.time().replace(second=0, microsecond=0),
                    )
                    bars.append(bar)
                except (KeyError, ValueError) as e:
                    logger.warning("Skipping malformed intraday bar", ticker=ticker, ts=ts, error=str(e))

            logger.info("Fetched intraday from Yahoo Finance", ticker=ticker, interval=interval, bars=len(bars))
            return bars

        except Exception as e:
            logger.error("Failed to fetch intraday from Yahoo Finance", ticker=ticker, error=str(e))
            return []
```

Also, rename the `time` import at line 2 to avoid collision:

```python
import time as time_module
```

And update line 29 from `time.sleep(...)` to `time_module.sleep(...)`.

- [ ] **Step 3: Add fetch_intraday stub to FinanceDataReaderClient**

In `src/adapter/client/finance_data_reader_client.py`, add after the `fetch_ohlcv` method (after line 57):

```python
    def fetch_intraday(self, ticker: str, interval: BarInterval = '5m') -> list[OhlcvBar]:
        """FinanceDataReader does not support intraday data. Returns empty list."""
        logger.info("Intraday not supported via FinanceDataReader", ticker=ticker)
        return []
```

Also add `BarInterval` to the import from `src.domain.model.ohlcv`:

```python
from src.domain.model.ohlcv import BarInterval, OhlcvBar
```

- [ ] **Step 4: Run existing tests**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting && python -m pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add src/adapter/persistence/ohlcv_repository.py src/adapter/client/yahoo_finance_client.py src/adapter/client/finance_data_reader_client.py
git commit -m "feat(charting): update repository upsert + add intraday fetch to clients"
```

---

## Task 4: Backend — SyncIntradayUseCase + API Changes

**Files:**
- Create: `src/application/usecase/sync_intraday_usecase.py`
- Modify: `src/application/usecase/get_symbol_ohlcv_usecase.py:1-40`
- Modify: `src/presentation/router/ohlcv_router.py:1-36`
- Modify: `src/presentation/dto/ohlcv_dto.py:1-15`
- Modify: `src/config/dependencies.py:1-72`

- [ ] **Step 1: Create SyncIntradayUseCase**

Create `src/application/usecase/sync_intraday_usecase.py`:

```python
"""SyncIntradayUseCase — TTL-based intraday bar synchronization."""
from datetime import datetime, timedelta, timezone

import structlog

from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.domain.model.ohlcv import BarInterval
from src.domain.port.market_data_client_port import MarketDataClientPort
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort
from src.domain.port.symbol_repository_port import SymbolRepositoryPort

logger = structlog.get_logger(__name__)

_INTRADAY_TTL = timedelta(minutes=5)


class SyncIntradayUseCase:
    def __init__(
        self,
        symbol_repo: SymbolRepositoryPort,
        ohlcv_repo: OhlcvRepositoryPort,
        market_client: MarketDataClientPort,
    ) -> None:
        self._symbol_repo = symbol_repo
        self._ohlcv_repo = ohlcv_repo
        self._market_client = market_client

    def execute(self, ticker: str, interval: BarInterval = '5m') -> dict:
        symbol = self._symbol_repo.find_by_ticker(ticker)
        if symbol is None:
            raise InvalidSymbolError(ticker)

        symbol_id = symbol.id
        if symbol_id is None:
            raise InvalidSymbolError(ticker)

        # TTL check
        latest = self._ohlcv_repo.find_latest_bar_time(symbol_id, interval)
        now = datetime.now(timezone.utc)
        if latest is not None:
            latest_utc = latest.replace(tzinfo=timezone.utc) if latest.tzinfo is None else latest
            if now - latest_utc < _INTRADAY_TTL:
                logger.info("Intraday TTL not expired", ticker=ticker, latest=latest)
                return {"synced": False, "reason": "TTL not expired"}

        bars = self._market_client.fetch_intraday(ticker, interval)
        if not bars:
            logger.warning("No intraday data returned", ticker=ticker)
            return {"synced": False, "reason": "No data available"}

        for b in bars:
            b.symbol_id = symbol_id

        count = self._ohlcv_repo.save_batch(bars)
        logger.info("Synced intraday bars", ticker=ticker, interval=interval, count=count)
        return {"synced": True, "bars_ingested": count}
```

- [ ] **Step 2: Update GetSymbolOhlcvUseCase to pass interval**

Replace `src/application/usecase/get_symbol_ohlcv_usecase.py`:

```python
"""GetSymbolOhlcvUseCase — retrieves stored OHLCV bars for a symbol."""
from datetime import date

import structlog

from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.domain.model.ohlcv import BarInterval, OhlcvBar
from src.domain.port.ohlcv_repository_port import OhlcvRepositoryPort
from src.domain.port.symbol_repository_port import SymbolRepositoryPort

logger = structlog.get_logger(__name__)


class GetSymbolOhlcvUseCase:
    def __init__(
        self,
        symbol_repo: SymbolRepositoryPort,
        ohlcv_repo: OhlcvRepositoryPort,
    ) -> None:
        self._symbol_repo = symbol_repo
        self._ohlcv_repo = ohlcv_repo

    def execute(
        self,
        ticker: str,
        start: date | None = None,
        end: date | None = None,
        interval: BarInterval = '1d',
    ) -> list[OhlcvBar]:
        symbol = self._symbol_repo.find_by_ticker(ticker)
        if symbol is None:
            raise InvalidSymbolError(ticker)

        symbol_id = symbol.id
        if symbol_id is None:
            raise InvalidSymbolError(ticker)

        bars = self._ohlcv_repo.find_by_symbol(symbol_id, start=start, end=end, interval=interval)
        logger.info("Retrieved OHLCV", ticker=ticker, interval=interval, bars=len(bars))
        return bars
```

- [ ] **Step 3: Update DTO**

Replace `src/presentation/dto/ohlcv_dto.py`:

```python
"""Pydantic v2 DTOs for OHLCV endpoints."""
from datetime import date, time
from decimal import Decimal

from pydantic import BaseModel


class OhlcvBarResponse(BaseModel):
    trade_date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    bar_time: time | None = None
```

- [ ] **Step 4: Update router**

Replace `src/presentation/router/ohlcv_router.py`:

```python
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

        # Auto-sync for intraday requests
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
```

- [ ] **Step 5: Update dependencies.py**

Add the sync intraday usecase wiring. After the existing `get_ohlcv_usecase` function (line 71), add:

```python
from src.application.usecase.sync_intraday_usecase import SyncIntradayUseCase

def get_sync_intraday_usecase(
    db: Session = Depends(get_db),
) -> SyncIntradayUseCase:
    return SyncIntradayUseCase(
        symbol_repo=SymbolRepository(db),
        ohlcv_repo=OhlcvRepository(db),
        market_client=YahooFinanceClient(),
    )
```

Add the import at the top of the file.

- [ ] **Step 6: Run all tests**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting && python -m pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 7: Manual smoke test**

Run: `curl "http://localhost:8010/api/v1/AAPL/ohlcv?interval=1d&start=2026-03-01" | python -m json.tool | head -20`
Expected: Daily OHLCV bars with `bar_time: null`

Run: `curl "http://localhost:8010/api/v1/AAPL/ohlcv?interval=5m" | python -m json.tool | head -20`
Expected: 5-minute bars with `bar_time` values like `"09:30:00"`

- [ ] **Step 8: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add src/application/ src/presentation/ src/config/dependencies.py
git commit -m "feat(charting): add SyncIntradayUseCase + interval param to OHLCV API"
```

---

## Task 5: Frontend — API + Aggregation Library

**Files:**
- Modify: `frontend/src/api.ts:1-88`
- Create: `frontend/src/lib/aggregation.ts`

- [ ] **Step 1: Update api.ts**

In `frontend/src/api.ts`, modify the `OhlcvBar` interface (line 16-23) and `fetchOhlcv` function (line 61-64):

Change `OhlcvBar` interface:

```typescript
export interface OhlcvBar {
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  bar_time?: string | null
}
```

Change `fetchOhlcv` function:

```typescript
export const fetchOhlcv = (ticker: string, interval: '1d' | '5m' = '1d', start?: string, end?: string) =>
  api
    .get<OhlcvBar[]>(`/api/v1/${ticker}/ohlcv`, { params: { interval, start, end } })
    .then((r) => r.data)
```

- [ ] **Step 2: Create aggregation.ts**

Create `frontend/src/lib/aggregation.ts`:

```typescript
import type { OhlcvBar } from '../api'
import { parseISO, getISOWeek, getISOWeekYear } from 'date-fns'

/** Group daily bars into weekly candles (ISO week, Mon-Fri) */
export function aggregateWeekly(bars: OhlcvBar[]): OhlcvBar[] {
  if (bars.length === 0) return []

  const groups = new Map<string, OhlcvBar[]>()
  for (const bar of bars) {
    const d = parseISO(bar.trade_date)
    const key = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
    const group = groups.get(key)
    if (group) group.push(bar)
    else groups.set(key, [bar])
  }

  return Array.from(groups.values()).map(aggregateGroup)
}

/** Group daily bars into monthly candles */
export function aggregateMonthly(bars: OhlcvBar[]): OhlcvBar[] {
  if (bars.length === 0) return []

  const groups = new Map<string, OhlcvBar[]>()
  for (const bar of bars) {
    const key = bar.trade_date.slice(0, 7) // YYYY-MM
    const group = groups.get(key)
    if (group) group.push(bar)
    else groups.set(key, [bar])
  }

  return Array.from(groups.values()).map(aggregateGroup)
}

function aggregateGroup(group: OhlcvBar[]): OhlcvBar {
  return {
    trade_date: group[group.length - 1].trade_date,
    open: group[0].open,
    high: Math.max(...group.map(b => b.high)),
    low: Math.min(...group.map(b => b.low)),
    close: group[group.length - 1].close,
    volume: group.reduce((sum, b) => sum + b.volume, 0),
  }
}

/** Filter bars to those within the last N days from the most recent bar */
export function filterRecent(bars: OhlcvBar[], days: number): OhlcvBar[] {
  if (bars.length === 0) return []
  const latest = parseISO(bars[bars.length - 1].trade_date)
  const cutoff = new Date(latest.getTime() - days * 24 * 60 * 60 * 1000)
  return bars.filter(b => parseISO(b.trade_date) >= cutoff)
}
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting/frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add frontend/src/api.ts frontend/src/lib/aggregation.ts
git commit -m "feat(charting-fe): add interval to fetchOhlcv + weekly/monthly aggregation"
```

---

## Task 6: Frontend — PeriodSelector Component + App Wiring

**Files:**
- Create: `frontend/src/components/PeriodSelector.tsx`
- Modify: `frontend/src/App.tsx:1-308`

- [ ] **Step 1: Create PeriodSelector component**

Create `frontend/src/components/PeriodSelector.tsx`:

```typescript
export type Period = '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y'

const PERIODS: { value: Period; label: string }[] = [
  { value: '1D', label: '1일' },
  { value: '1W', label: '1주' },
  { value: '1M', label: '1개월' },
  { value: '3M', label: '3개월' },
  { value: '1Y', label: '1년' },
  { value: '5Y', label: '5년' },
]

interface Props {
  value: Period
  onChange: (period: Period) => void
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            value === p.value
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Wire PeriodSelector into App.tsx**

In `frontend/src/App.tsx`, add the following changes:

**Add imports** (after line 12):
```typescript
import { PeriodSelector, type Period } from './components/PeriodSelector'
import { aggregateWeekly, aggregateMonthly, filterRecent } from './lib/aggregation'
```

**Add state** (after line 28, the `activeTab` state):
```typescript
const [period, setPeriod] = useState<Period>('3M')
```

**Add intraday query** (after the existing `ohlcv` query at line 35):
```typescript
const { data: intradayBars = [] } = useQuery({
  queryKey: ['ohlcv', ticker, '5m'],
  queryFn: () => fetchOhlcv(ticker, '5m'),
  enabled: !!ticker && period === '1D',
})
```

**Add displayBars derivation** (after the queries, before the sync useEffect):
```typescript
const displayBars = useMemo(() => {
  switch (period) {
    case '1D': return intradayBars
    case '1W': return filterRecent(ohlcv, 7)
    case '1M': return filterRecent(ohlcv, 30)
    case '3M': return filterRecent(ohlcv, 90)
    case '1Y': return aggregateWeekly(filterRecent(ohlcv, 365))
    case '5Y': return aggregateMonthly(ohlcv)
  }
}, [period, ohlcv, intradayBars])
```

**Reset pattern state on period change** (after the displayBars memo):
```typescript
useEffect(() => {
  setPatternMatches([])
  setSelectedIds(new Set())
}, [period])
```

**Update pattern matching** — change the existing `useEffect` (line 76-86) to use `displayBars` instead of `ohlcv`:
```typescript
useEffect(() => {
  if (displayBars.length >= 20) {
    const closes = displayBars.map(b => Number(b.close))
    const matches = matchPatterns(closes, PATTERNS, Math.min(60, displayBars.length))
    setPatternMatches(matches)
    setSelectedIds(new Set(matches[0] ? [matches[0].pattern.id] : []))
  } else {
    setPatternMatches([])
    setSelectedIds(new Set())
  }
}, [displayBars])
```

**Update price calculation** (lines 114-118) to use `displayBars`:
```typescript
const lastPrice = displayBars.length > 0 ? Number(displayBars[displayBars.length - 1].close) : 0
const firstPrice = displayBars.length > 0 ? Number(displayBars[0].close) : 0
```

**Add PeriodSelector to the chart header** — insert before the chart div (after line 268, before line 271):
```typescript
{ticker && (
  <div className="flex items-center justify-between px-1">
    <PeriodSelector value={period} onChange={setPeriod} />
  </div>
)}
```

**Update PatternChart props** — change `ohlcv={ohlcv}` to `ohlcv={displayBars}` (line 277).

- [ ] **Step 3: Verify frontend builds and runs**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting/frontend && npx tsc --noEmit`
Expected: No type errors

Manually verify in browser: `http://localhost:5173`
- Period buttons visible above chart
- Switching periods changes chart data
- 1Y shows weekly candles, 5Y shows monthly candles
- 1D fetches 5m bars from backend

- [ ] **Step 4: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add frontend/src/components/PeriodSelector.tsx frontend/src/App.tsx
git commit -m "feat(charting-fe): add period selector with candle aggregation"
```

---

## Task 7: Frontend — Smart Pattern Overlay (Auto-positioning)

**Files:**
- Modify: `frontend/src/lib/patternMatcher.ts:1-60`
- Modify: `frontend/src/components/PatternChart.tsx:200-255`

- [ ] **Step 1: Add findBestMatchOffset to patternMatcher.ts**

Add after the existing `matchPatterns` function (line 59):

```typescript
/** Slide a pattern across all bars and return the best-matching offset */
export function findBestMatchOffset(
  closes: number[],
  pattern: PatternDefinition,
  windowSize: number = 60,
): { offset: number; score: number } | null {
  const W = Math.min(windowSize, closes.length)
  if (closes.length < 20) return null

  const interpolated = interpolatePattern(pattern.curve, W)
  let bestOffset = 0
  let bestScore = -Infinity

  for (let offset = 0; offset <= closes.length - W; offset++) {
    const window = closes.slice(offset, offset + W)
    const normalized = minMaxNormalize(window)
    const r = pearsonCorr(normalized, interpolated)
    const score = ((r + 1) / 2) * 100
    if (score > bestScore) {
      bestScore = score
      bestOffset = offset
    }
  }

  return { offset: bestOffset, score: Math.round(bestScore) }
}
```

- [ ] **Step 2: Update PatternChart overlay logic**

In `frontend/src/components/PatternChart.tsx`, modify the pattern overlay section (approximately lines 203-255). The key change: instead of always using the last 60 bars, use `findBestMatchOffset` to determine where to place the pattern.

Replace the pattern overlay block with:

```typescript
// Pattern overlays — smart positioning
patterns.forEach((p, idx) => {
  const closes = data.map(b => Number(b.close))
  const W = Math.min(WINDOW, data.length)
  if (data.length < 20) return

  const bestMatch = findBestMatchOffset(closes, p, W)
  if (!bestMatch) return

  const { offset } = bestMatch
  const windowBars = data.slice(offset, offset + W)
  const windowCloses = windowBars.map(b => Number(b.close))
  const priceMin = Math.min(...windowCloses)
  const priceMax = Math.max(...windowCloses)
  const priceRange = priceMax - priceMin || 1
  const scale = (y: number) => priceMin + y * priceRange

  // Overlay line (pattern curve mapped to best-match window)
  const interp = interpolatePattern(p.curve, W)
  const overlayData = windowBars.map((bar, i) => ({
    time: bar.trade_date as string,
    value: scale(interp[i]),
  }))

  const overlaySeries = chart.addLineSeries({
    color: p.color,
    lineWidth: 2,
    lineStyle: 0, // Solid
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  overlaySeries.setData(overlayData)

  // Projection (future extension from pattern end)
  const projInterp = interpolatePattern(
    p.projection.map(pt => ({ x: (pt.x - 1) / 0.33, y: pt.y })),
    PROJ_DAYS + 1,
  )
  const lastDate = parseISO(data[Math.min(offset + W - 1, data.length - 1)].trade_date)
  const projData = projInterp.map((y, i) => ({
    time: addDays(lastDate, i + 1).toISOString().slice(0, 10) as string,
    value: scale(y),
  }))

  const projSeries = chart.addLineSeries({
    color: p.color,
    lineWidth: 2,
    lineStyle: 2, // Dashed
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  })
  projSeries.setData(projData)

  // "Best match" marker on first pattern only
  if (idx === 0 && windowBars.length > 0) {
    const markerBar = windowBars[windowBars.length - 1]
    candleSeries.setMarkers([{
      time: markerBar.trade_date as string,
      position: 'aboveBar',
      color: p.color,
      shape: 'arrowDown',
      text: `${bestMatch.score}%`,
    }])
  }
})
```

Note: Add `import { findBestMatchOffset } from '../lib/patternMatcher'` at the top of PatternChart.tsx.

Also add `import { interpolatePattern } from '../lib/patternMatcher'` if not already imported.

**Important**: Use `ohlcv` (the prop name) instead of `data` throughout this code. The variable in the existing PatternChart component is the `ohlcv` prop.

**Important**: For projection normalization, use dynamic range instead of hard-coded `0.33`:

```typescript
const projXMin = p.projection[0].x
const projXMax = p.projection[p.projection.length - 1].x
const projXRange = projXMax - projXMin || 0.33
const projInterp = interpolatePattern(
  p.projection.map(pt => ({ x: (pt.x - projXMin) / projXRange, y: pt.y })),
  PROJ_DAYS + 1,
)
```

- [ ] **Step 3: Verify in browser**

Expected:
- Pattern overlay now appears at the most similar segment, not always at the end
- Marker shows similarity score percentage
- Projection extends from the matched window into the future

- [ ] **Step 4: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add frontend/src/lib/patternMatcher.ts frontend/src/components/PatternChart.tsx
git commit -m "feat(charting-fe): smart pattern overlay auto-positioning with best-match offset"
```

---

## Task 8: Frontend — Pattern Overlay Drag + Scale Interaction

**Files:**
- Modify: `frontend/src/components/PatternChart.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add overlay interaction state to App.tsx**

Add new state variables (after the `period` state):

```typescript
const [patternOffset, setPatternOffset] = useState<number | null>(null) // null = auto
const [patternWidth, setPatternWidth] = useState(60)
```

Reset on period change (update the existing period reset effect):

```typescript
useEffect(() => {
  setPatternMatches([])
  setSelectedIds(new Set())
  setPatternOffset(null)
  setPatternWidth(60)
}, [period])
```

Pass to PatternChart:

```typescript
<PatternChart
  ohlcv={displayBars}
  patterns={selectedPatterns}
  indicators={indicators}
  patternOffset={patternOffset}
  onPatternOffsetChange={setPatternOffset}
  patternWidth={patternWidth}
  onPatternWidthChange={setPatternWidth}
/>
```

- [ ] **Step 2: Add drag/scale to PatternChart**

Update PatternChart props interface to accept the new props:

```typescript
interface Props {
  ohlcv: OhlcvBar[]
  patterns: PatternDefinition[]
  indicators: Indicators
  patternOffset?: number | null
  onPatternOffsetChange?: (offset: number | null) => void
  patternWidth?: number
  onPatternWidthChange?: (width: number) => void
}
```

Add a **transparent overlay div** positioned over the chart (not on the chart container itself) to avoid conflicting with lightweight-charts' own pan/zoom mouse handling.

**Key principle**: The overlay div starts with `pointer-events: none` and only enables `pointer-events: auto` when the mouse is hovering over the pattern overlay region. This lets the chart handle normal interactions (pan/zoom/crosshair) while allowing pattern drag/scale only in the overlay area.

```typescript
// Drag state
const dragRef = useRef<{ dragging: boolean; startX: number; startOffset: number }>({
  dragging: false, startX: 0, startOffset: 0,
})
const [hovering, setHovering] = useState(false)

// Determine effective offset
const effectiveOffset = patternOffset ?? autoOffset

// Compute pattern overlay screen bounds (for hit-testing)
// This uses chart.timeScale().timeToCoordinate() to get pixel positions
const getOverlayBounds = useCallback(() => {
  if (!chartRef.current || !ohlcv.length) return null
  const chart = chartRef.current
  const startBar = ohlcv[effectiveOffset]
  const endBar = ohlcv[Math.min(effectiveOffset + patternWidth - 1, ohlcv.length - 1)]
  if (!startBar || !endBar) return null
  const x1 = chart.timeScale().timeToCoordinate(startBar.trade_date as any)
  const x2 = chart.timeScale().timeToCoordinate(endBar.trade_date as any)
  if (x1 === null || x2 === null) return null
  return { left: Math.min(x1, x2), right: Math.max(x1, x2) }
}, [effectiveOffset, patternWidth, ohlcv])
```

The interaction overlay div sits **inside the chart container**, positioned absolutely:

```tsx
{/* Chart container (relative positioning for overlay) */}
<div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
  {/* Transparent interaction layer — only captures events in pattern region */}
  {patterns.length > 0 && (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 10,
        pointerEvents: hovering || dragRef.current.dragging ? 'auto' : 'none',
        cursor: dragRef.current.dragging ? 'grabbing' : hovering ? 'grab' : 'default',
      }}
      onMouseMove={(e) => {
        const bounds = getOverlayBounds()
        if (!bounds) return
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const inBounds = x >= bounds.left && x <= bounds.right
        setHovering(inBounds)

        if (dragRef.current.dragging && chartRef.current) {
          const barWidth = chartRef.current.timeScale().width() / ohlcv.length
          const deltaX = e.clientX - dragRef.current.startX
          const deltaBars = Math.round(deltaX / barWidth)
          const maxOffset = ohlcv.length - patternWidth
          const newOffset = Math.max(0, Math.min(maxOffset, dragRef.current.startOffset + deltaBars))
          onPatternOffsetChange?.(newOffset)
        }
      }}
      onMouseDown={(e) => {
        if (!hovering) return
        dragRef.current = { dragging: true, startX: e.clientX, startOffset: effectiveOffset }
        e.preventDefault()
      }}
      onMouseUp={() => { dragRef.current.dragging = false }}
      onMouseLeave={() => { dragRef.current.dragging = false; setHovering(false) }}
      onWheel={(e) => {
        if (!hovering) return
        e.preventDefault()
        const delta = e.deltaY > 0 ? -1 : 1
        const newWidth = Math.max(20, Math.min(120, patternWidth + delta))
        onPatternWidthChange?.(newWidth)
      }}
    />
  )}
</div>
```

Update the pattern overlay rendering to use `effectiveOffset` and `patternWidth` instead of the auto-computed values.

- [ ] **Step 3: Add score tooltip during drag**

When dragging, compute and display the similarity score at the current offset. Add a floating div:

```typescript
{dragRef.current.dragging && (
  <div className="absolute top-2 right-2 bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white z-10">
    유사도: {currentScore}% | {patternWidth}봉
  </div>
)}
```

- [ ] **Step 4: Add reset button**

Add a reset button that returns to auto-positioning:

```typescript
{patternOffset !== null && (
  <button
    onClick={() => onPatternOffsetChange?.(null)}
    className="absolute top-2 left-2 bg-slate-800/90 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 hover:text-white z-10"
  >
    ↺ 자동 배치
  </button>
)}
```

- [ ] **Step 5: Verify in browser**

Expected:
- Can drag pattern overlay left/right with mouse
- Overlay snaps to bar positions
- Score tooltip shows during drag
- Mouse wheel on overlay changes pattern width (20-120 range)
- "자동 배치" button resets to auto-positioning

- [ ] **Step 6: Commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add frontend/src/components/PatternChart.tsx frontend/src/App.tsx
git commit -m "feat(charting-fe): add drag and scale interaction for pattern overlay"
```

---

## Task 9: End-to-End Verification + Cleanup

**Files:** All modified files

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting && python -m pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 2: Verify frontend TypeScript**

Run: `cd /Users/gideok-kwon/IdeaProjects/msa/charting/frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Full E2E manual verification**

Verify in browser at `http://localhost:5173`:

1. **Period selection**: Click each button (1D/1W/1M/3M/1Y/5Y)
   - 1D: Shows 5m bars, calls backend with interval=5m
   - 1W: Shows ~5 daily bars for last week
   - 1M: Shows ~22 daily bars for last month
   - 3M: Shows ~60 daily bars (default, same as before)
   - 1Y: Shows ~52 weekly aggregated bars
   - 5Y: Shows ~60 monthly aggregated bars

2. **Pattern overlay**:
   - Pattern appears at the most similar segment, not fixed to end
   - Score shown as marker text
   - Projection extends to the right (future)

3. **Drag**: Mouse drag moves the pattern overlay horizontally
4. **Scale**: Mouse wheel adjusts pattern width
5. **Reset**: "자동 배치" button returns to auto-positioning
6. **Period switch resets**: Switching period resets drag offset and width

- [ ] **Step 4: Final commit**

```bash
cd /Users/gideok-kwon/IdeaProjects/msa/charting
git add -A
git status  # verify no unwanted files
git commit -m "chore(charting): cleanup and finalize period selection + smart pattern overlay"
```
