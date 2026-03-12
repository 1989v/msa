"""Domain policy — 32-dim feature extraction rules.

This file defines WHAT the 32 dimensions mean and their index positions.
The actual numerical computation is delegated to an adapter (NumpyFeatureExtractor)
via the FeatureExtractorPort interface — frameworks/numpy are NOT imported here.
"""
from abc import ABC, abstractmethod

from src.domain.model.embedding import Embedding
from src.domain.model.ohlcv import OhlcvBar

WINDOW_SIZE = 60    # number of trading days per pattern
EMBEDDING_DIM = 32  # total embedding dimensions

# --- Dimension index constants (documentation + policy enforcement) ---
# Scalar features
DIM_PRICE_CHANGE = 0    # (close[-1] - close[0]) / close[0]
DIM_VOLATILITY = 1      # std(log_returns)
DIM_SLOPE = 2           # linear regression slope on normalized close prices
DIM_MAX_DRAWDOWN = 3    # max peak-to-trough decline
DIM_MAX_RALLY = 4       # max trough-to-peak advance
DIM_PEAK_COUNT = 5      # local maxima count / WINDOW_SIZE
DIM_VALLEY_COUNT = 6    # local minima count / WINDOW_SIZE
DIM_VOLUME_CHANGE = 7   # (last-15-day avg vol - first-15-day avg vol) / first-15-day avg vol
DIM_RSI_14 = 8          # RSI(14) final bar, scaled 0~1
DIM_MACD_SIGNAL = 9     # (MACD line - signal line), z-scored
DIM_MA5_DISTANCE = 10   # (close[-1] - ma5[-1]) / close[-1]
DIM_MA20_DISTANCE = 11  # (close[-1] - ma20[-1]) / close[-1]

# Shape features: dims 12..31 — 60-day normalized close → 20-point downsampled
DIM_SHAPE_START = 12
DIM_SHAPE_END = 31      # inclusive (20 points)
SHAPE_POINTS = 20       # DIM_SHAPE_END - DIM_SHAPE_START + 1 = 20 ✓


class FeatureExtractorPort(ABC):
    """Port for computing the 32-dim embedding from a 60-day OHLCV window.

    Implementations live in adapter/computation/ (e.g., NumpyFeatureExtractor).
    """

    @abstractmethod
    def extract(self, bars: list[OhlcvBar]) -> Embedding:
        """Compute a 32-dim embedding from exactly WINDOW_SIZE bars.

        Raises InsufficientDataError if len(bars) < WINDOW_SIZE.
        """
