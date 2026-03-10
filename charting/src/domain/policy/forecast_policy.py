"""Domain policy — ForecastPolicy.

Computes aggregate forecast statistics from a list of SimilarityResult objects.
Uses only Python stdlib (statistics module) — no numpy/pandas here.
"""
import statistics
from dataclasses import dataclass
from decimal import Decimal

from src.domain.model.similarity_result import SimilarityResult


@dataclass(frozen=True)
class ForecastStats:
    patterns: int
    avg_return_5d: float | None
    avg_return_20d: float | None
    avg_return_60d: float | None
    median_return_5d: float | None
    median_return_20d: float | None
    median_return_60d: float | None
    positive_probability_5d: float | None
    positive_probability_20d: float | None
    positive_probability_60d: float | None


class ForecastPolicy:
    """Computes forecast statistics from a list of matched similar patterns."""

    def compute(self, results: list[SimilarityResult]) -> ForecastStats:
        """Aggregate return statistics across matched patterns.

        Only realized returns (non-None) are included in statistics.
        Returns None for each stat when no realized data is available.
        """
        r5 = [float(r.return_5d) for r in results if r.return_5d is not None]
        r20 = [float(r.return_20d) for r in results if r.return_20d is not None]
        r60 = [float(r.return_60d) for r in results if r.return_60d is not None]

        return ForecastStats(
            patterns=len(results),
            avg_return_5d=statistics.mean(r5) if r5 else None,
            avg_return_20d=statistics.mean(r20) if r20 else None,
            avg_return_60d=statistics.mean(r60) if r60 else None,
            median_return_5d=statistics.median(r5) if r5 else None,
            median_return_20d=statistics.median(r20) if r20 else None,
            median_return_60d=statistics.median(r60) if r60 else None,
            positive_probability_5d=self._positive_prob(r5),
            positive_probability_20d=self._positive_prob(r20),
            positive_probability_60d=self._positive_prob(r60),
        )

    @staticmethod
    def _positive_prob(returns: list[float]) -> float | None:
        if not returns:
            return None
        positive = sum(1 for r in returns if r > 0)
        return positive / len(returns)
