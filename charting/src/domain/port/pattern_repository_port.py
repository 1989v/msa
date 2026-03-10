"""Port — pattern persistence abstraction. No framework imports."""
from abc import ABC, abstractmethod
from datetime import date

from src.domain.model.embedding import Embedding
from src.domain.model.pattern import Pattern
from src.domain.model.similarity_result import SimilarityResult


class PatternRepositoryPort(ABC):
    @abstractmethod
    def save(self, pattern: Pattern) -> Pattern:
        """Persist a pattern and return it with a populated id."""

    @abstractmethod
    def save_batch(self, patterns: list[Pattern]) -> int:
        """Upsert a batch of patterns. Returns the number of rows inserted/updated."""

    @abstractmethod
    def search_similar(
        self,
        embedding: Embedding,
        top_k: int = 20,
        exclude_symbol_id: int | None = None,
    ) -> list[SimilarityResult]:
        """Return top-k most similar patterns using cosine similarity via pgvector HNSW index."""

    @abstractmethod
    def find_by_symbol(self, symbol_id: int) -> list[Pattern]:
        """Return all patterns for a symbol, ordered by window_start ASC."""

    @abstractmethod
    def find_unrealized_returns(self, as_of: date) -> list[Pattern]:
        """Return patterns where return_5d/20d/60d is NULL and the window has ended by as_of."""

    @abstractmethod
    def update_returns(self, pattern_id: int, return_5d: float | None, return_20d: float | None, return_60d: float | None) -> None:
        """Update the realized forward returns for a pattern."""
