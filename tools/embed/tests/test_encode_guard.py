import numpy as np
import pytest

from embed import bakeoff
from embed.models import CANDIDATES


class _NaNModel:
    def encode(self, texts, **kw):
        v = np.ones((len(texts), 4), dtype=np.float32)
        v[0, 0] = np.nan
        return v


def test_encode_rejects_nan():
    with pytest.raises(RuntimeError, match="NaN"):
        bakeoff.encode(_NaNModel(), ["a", "b"], prompt=None, dim=4)


def test_harrier_specs_are_marked_fp16_unsafe():
    assert CANDIDATES["harrier-270m"].fp16_ok is False
    assert CANDIDATES["harrier-0.6b"].fp16_ok is False
