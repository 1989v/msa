"""배치 크기가 CLI 에서 모델까지 닿는가.

판정 근거는 **모델이 실제로 받은 인자**다 — 넘겼다는 사실이 아니라.
"""
import numpy as np
import pytest

from embed import bakeoff, models
from embed.models import ModelSpec

SPEC = ModelSpec(key="fake", hf_id="acme/fake", dim=4, native_dim=8, pooling="cls", mrl=True,
                 query_prompt=None, revision="abcdef0123")


class SpyModel:
    def __init__(self):
        self.batches: list[int] = []

    def encode(self, texts, *, prompt=None, batch_size=None, normalize_embeddings=True,
               convert_to_numpy=True, show_progress_bar=False):
        self.batches.append(batch_size)
        v = np.ones((len(texts), SPEC.native_dim), dtype=np.float32)
        return v / np.linalg.norm(v, axis=1, keepdims=True)


ATTRACTIONS = [{"id": 1, "title": "가", "category": "관광지", "address": "서울 중구", "overview": "개요", "lang": "ko"}]
JUDGMENTS = [{"query": "질의", "lang": "ko", "candidates": [{"id": 1, "grade": 3}]}]


def test_evaluate_passes_the_batch_size_to_the_model():
    m = SpyModel()
    bakeoff.evaluate(SPEC, m, ATTRACTIONS, JUDGMENTS, dims=[4], rules=["full"],
                     lang_filter="ko", batch_size=8)
    assert m.batches == [8, 8]  # 질의 인코딩과 문서 인코딩 둘 다


def test_default_is_still_64():
    m = SpyModel()
    bakeoff.evaluate(SPEC, m, ATTRACTIONS, JUDGMENTS, dims=[4], rules=["full"], lang_filter="ko")
    assert set(m.batches) == {64}


def test_cli_flag_reaches_evaluate(monkeypatch, tmp_path):
    seen = {}

    def fake_evaluate(spec, model, attractions, judgments, **kw):
        seen.update(kw)
        return [], {}

    monkeypatch.setattr(bakeoff, "load_model", lambda spec, device=None: SpyModel())
    monkeypatch.setattr(models, "resolve_revision", lambda spec: SPEC)
    monkeypatch.setattr(models, "CANDIDATES", {"fake": SPEC})
    monkeypatch.setattr(bakeoff, "evaluate", fake_evaluate)
    corpus = tmp_path / "c.json"; corpus.write_text("[]", encoding="utf-8")
    j = tmp_path / "j.yml"; j.write_text("queries: []\n", encoding="utf-8")
    bakeoff.main(["--model", "fake", "--judgments", str(j), "--corpus", str(corpus),
                  "--dims", "4", "--rules", "full", "--batch-size", "8"])
    assert seen["batch_size"] == 8
