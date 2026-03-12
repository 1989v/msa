"""NumpyFeatureExtractor — adapter implementing FeatureExtractorPort.

Computes the 32-dim embedding using numpy/scipy.
See domain/policy/feature_extraction_policy.py for dimension definitions.
"""
import numpy as np
from scipy import signal, stats

from src.domain.exception.charting_exceptions import InsufficientDataError
from src.domain.model.embedding import Embedding
from src.domain.model.ohlcv import OhlcvBar
from src.domain.policy.feature_extraction_policy import (
    EMBEDDING_DIM,
    SHAPE_POINTS,
    WINDOW_SIZE,
    FeatureExtractorPort,
)


class NumpyFeatureExtractor(FeatureExtractorPort):
    """Computes 32-dim OHLCV embedding using numpy and scipy."""

    def extract(self, bars: list[OhlcvBar]) -> Embedding:
        if len(bars) < WINDOW_SIZE:
            raise InsufficientDataError(
                ticker=f"symbol_id={bars[0].symbol_id}" if bars else "unknown",
                available=len(bars),
                required=WINDOW_SIZE,
            )

        # Use only the last WINDOW_SIZE bars
        bars = bars[-WINDOW_SIZE:]
        closes = np.array([float(b.close) for b in bars], dtype=np.float64)
        volumes = np.array([float(b.volume) for b in bars], dtype=np.float64)

        features: list[float] = []

        # dim 0: price_change
        features.append((closes[-1] - closes[0]) / closes[0] if closes[0] != 0 else 0.0)

        # dim 1: volatility (std of log returns)
        log_returns = np.diff(np.log(np.maximum(closes, 1e-10)))
        features.append(float(np.std(log_returns)))

        # dim 2: slope (linear regression on normalized closes)
        norm_closes = (closes - closes.min()) / (closes.max() - closes.min() + 1e-10)
        x = np.arange(WINDOW_SIZE, dtype=np.float64)
        slope, *_ = stats.linregress(x, norm_closes)
        features.append(float(slope))

        # dim 3: max_drawdown
        running_max = np.maximum.accumulate(closes)
        drawdown = (running_max - closes) / (running_max + 1e-10)
        features.append(float(np.max(drawdown)))

        # dim 4: max_rally (max trough-to-peak advance)
        running_min = np.minimum.accumulate(closes)
        rally = (closes - running_min) / (running_min + 1e-10)
        features.append(float(np.max(rally)))

        # dim 5: peak_count / WINDOW_SIZE
        peaks, _ = signal.find_peaks(closes)
        features.append(len(peaks) / WINDOW_SIZE)

        # dim 6: valley_count / WINDOW_SIZE
        valleys, _ = signal.find_peaks(-closes)
        features.append(len(valleys) / WINDOW_SIZE)

        # dim 7: volume_change (last 15 vs first 15)
        vol_first = np.mean(volumes[:15]) if len(volumes) >= 15 else np.mean(volumes)
        vol_last = np.mean(volumes[-15:]) if len(volumes) >= 15 else np.mean(volumes)
        features.append((vol_last - vol_first) / (vol_first + 1e-10))

        # dim 8: RSI(14) final bar, scaled 0~1
        features.append(self._rsi14(closes) / 100.0)

        # dim 9: MACD - signal (z-scored)
        macd_val = self._macd_signal_diff(closes)
        features.append(float(macd_val))

        # dim 10: ma5 distance
        ma5 = np.mean(closes[-5:]) if len(closes) >= 5 else closes[-1]
        features.append((closes[-1] - ma5) / (closes[-1] + 1e-10))

        # dim 11: ma20 distance
        ma20 = np.mean(closes[-20:]) if len(closes) >= 20 else closes[-1]
        features.append((closes[-1] - ma20) / (closes[-1] + 1e-10))

        # dims 12-31: shape features (20-point downsampled normalized close)
        norm = (closes - closes.min()) / (closes.max() - closes.min() + 1e-10)
        indices = np.linspace(0, WINDOW_SIZE - 1, SHAPE_POINTS).astype(int)
        shape = norm[indices]
        features.extend(shape.tolist())

        assert len(features) == EMBEDDING_DIM, f"Expected {EMBEDDING_DIM} dims, got {len(features)}"
        return Embedding(vector=[float(f) for f in features])

    @staticmethod
    def _rsi14(closes: np.ndarray) -> float:
        """Compute RSI(14) for the last bar."""
        if len(closes) < 15:
            return 50.0
        deltas = np.diff(closes[-15:])
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return float(100.0 - 100.0 / (1.0 + rs))

    @staticmethod
    def _macd_signal_diff(closes: np.ndarray) -> float:
        """Return MACD line minus signal line, z-scored by close std."""
        if len(closes) < 26:
            return 0.0

        def ema(data: np.ndarray, period: int) -> np.ndarray:
            k = 2.0 / (period + 1)
            result = np.empty_like(data)
            result[0] = data[0]
            for i in range(1, len(data)):
                result[i] = data[i] * k + result[i - 1] * (1 - k)
            return result

        ema12 = ema(closes, 12)
        ema26 = ema(closes, 26)
        macd_line = ema12 - ema26
        signal_line = ema(macd_line[25:], 9)  # start after EMA26 stabilizes
        diff = macd_line[-1] - signal_line[-1]
        std = np.std(closes)
        return float(diff / (std + 1e-10))
