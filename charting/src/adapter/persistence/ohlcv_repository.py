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
