"""SQLAlchemy implementation of SymbolRepositoryPort."""
from datetime import datetime

from sqlalchemy.orm import Session

from src.adapter.persistence.orm import SymbolOrm
from src.domain.model.symbol import Symbol
from src.domain.port.symbol_repository_port import SymbolRepositoryPort


class SymbolRepository(SymbolRepositoryPort):
    def __init__(self, session: Session) -> None:
        self._session = session

    def save(self, symbol: Symbol) -> Symbol:
        orm = SymbolOrm(
            ticker=symbol.ticker,
            name=symbol.name,
            market=symbol.market,
            active=symbol.active,
        )
        self._session.add(orm)
        self._session.flush()
        return self._to_domain(orm)

    def find_by_ticker(self, ticker: str) -> Symbol | None:
        orm = (
            self._session.query(SymbolOrm).filter(SymbolOrm.ticker == ticker).first()
        )
        return self._to_domain(orm) if orm else None

    def find_all_active(self) -> list[Symbol]:
        rows = (
            self._session.query(SymbolOrm)
            .filter(SymbolOrm.active.is_(True))
            .order_by(SymbolOrm.ticker)
            .all()
        )
        return [self._to_domain(r) for r in rows]

    @staticmethod
    def _to_domain(orm: SymbolOrm) -> Symbol:
        return Symbol(
            id=orm.id,
            ticker=orm.ticker,
            name=orm.name,
            market=orm.market,
            active=orm.active,
            created_at=orm.created_at,
        )
