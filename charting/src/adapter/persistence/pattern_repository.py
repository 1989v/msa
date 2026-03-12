"""SQLAlchemy + pgvector implementation of PatternRepositoryPort."""
from datetime import date
from decimal import Decimal

from pgvector.sqlalchemy import Vector
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from src.adapter.persistence.orm import OhlcvBarOrm, PatternOrm, SymbolOrm
from src.domain.model.embedding import Embedding
from src.domain.model.pattern import Pattern
from src.domain.model.similarity_result import SimilarityResult
from src.domain.port.pattern_repository_port import PatternRepositoryPort


class PatternRepository(PatternRepositoryPort):
    def __init__(self, session: Session) -> None:
        self._session = session

    def save(self, pattern: Pattern) -> Pattern:
        orm = self._to_orm(pattern)
        self._session.add(orm)
        self._session.flush()
        pattern.id = orm.id
        pattern.created_at = orm.created_at
        return pattern

    def save_batch(self, patterns: list[Pattern]) -> int:
        if not patterns:
            return 0
        rows = [
            {
                "symbol_id": p.symbol_id,
                "window_start": p.window_start,
                "window_end": p.window_end,
                "embedding": p.embedding.vector,
                "return_5d": float(p.return_5d) if p.return_5d is not None else None,
                "return_20d": float(p.return_20d) if p.return_20d is not None else None,
                "return_60d": float(p.return_60d) if p.return_60d is not None else None,
            }
            for p in patterns
        ]
        stmt = (
            insert(PatternOrm)
            .values(rows)
            .on_conflict_do_update(
                index_elements=["symbol_id", "window_start"],
                set_={
                    "window_end": text("EXCLUDED.window_end"),
                    "embedding": text("EXCLUDED.embedding"),
                },
            )
        )
        result = self._session.execute(stmt)
        return result.rowcount

    def search_similar(
        self,
        embedding: Embedding,
        top_k: int = 20,
        exclude_symbol_id: int | None = None,
    ) -> list[SimilarityResult]:
        """Cosine similarity search using pgvector HNSW index."""
        vector_literal = str(embedding.vector)

        query = (
            self._session.query(
                PatternOrm,
                SymbolOrm.ticker,
                (
                    1
                    - PatternOrm.embedding.cosine_distance(embedding.vector)
                ).label("similarity"),
            )
            .join(SymbolOrm, PatternOrm.symbol_id == SymbolOrm.id)
            .filter(SymbolOrm.active.is_(True))
        )
        if exclude_symbol_id is not None:
            query = query.filter(PatternOrm.symbol_id != exclude_symbol_id)

        rows = (
            query.order_by(
                PatternOrm.embedding.cosine_distance(embedding.vector)
            )
            .limit(top_k)
            .all()
        )

        results = []
        for pattern_orm, ticker, similarity in rows:
            results.append(
                SimilarityResult(
                    pattern_id=pattern_orm.id,
                    ticker=ticker,
                    window_start=pattern_orm.window_start,
                    window_end=pattern_orm.window_end,
                    similarity=float(similarity),
                    return_5d=(
                        Decimal(str(pattern_orm.return_5d))
                        if pattern_orm.return_5d is not None
                        else None
                    ),
                    return_20d=(
                        Decimal(str(pattern_orm.return_20d))
                        if pattern_orm.return_20d is not None
                        else None
                    ),
                    return_60d=(
                        Decimal(str(pattern_orm.return_60d))
                        if pattern_orm.return_60d is not None
                        else None
                    ),
                )
            )
        return results

    def find_by_symbol(self, symbol_id: int) -> list[Pattern]:
        rows = (
            self._session.query(PatternOrm)
            .filter(PatternOrm.symbol_id == symbol_id)
            .order_by(PatternOrm.window_start.asc())
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def find_unrealized_returns(self, as_of: date) -> list[Pattern]:
        rows = (
            self._session.query(PatternOrm)
            .filter(
                PatternOrm.return_5d.is_(None),
                PatternOrm.window_end <= as_of,
            )
            .all()
        )
        return [self._to_domain(r) for r in rows]

    def update_returns(
        self,
        pattern_id: int,
        return_5d: float | None,
        return_20d: float | None,
        return_60d: float | None,
    ) -> None:
        self._session.query(PatternOrm).filter(PatternOrm.id == pattern_id).update(
            {
                "return_5d": return_5d,
                "return_20d": return_20d,
                "return_60d": return_60d,
            }
        )

    @staticmethod
    def _to_orm(pattern: Pattern) -> PatternOrm:
        return PatternOrm(
            symbol_id=pattern.symbol_id,
            window_start=pattern.window_start,
            window_end=pattern.window_end,
            embedding=pattern.embedding.vector,
            return_5d=float(pattern.return_5d) if pattern.return_5d is not None else None,
            return_20d=float(pattern.return_20d) if pattern.return_20d is not None else None,
            return_60d=float(pattern.return_60d) if pattern.return_60d is not None else None,
        )

    @staticmethod
    def _to_domain(orm: PatternOrm) -> Pattern:
        return Pattern(
            id=orm.id,
            symbol_id=orm.symbol_id,
            window_start=orm.window_start,
            window_end=orm.window_end,
            embedding=Embedding(vector=list(orm.embedding)),
            return_5d=Decimal(str(orm.return_5d)) if orm.return_5d is not None else None,
            return_20d=Decimal(str(orm.return_20d)) if orm.return_20d is not None else None,
            return_60d=Decimal(str(orm.return_60d)) if orm.return_60d is not None else None,
            created_at=orm.created_at,
        )
