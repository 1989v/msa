"""저장된 인코딩 → 첫 채움 parquet 브리지.

판정 근거는 **push 가 실제로 쓰는 검사**(`push.validate`)다 — 이 테스트가 만든 사본이 아니다.
"""
import numpy as np
import pandas as pd
import pytest

from embed import push
from embed.bakeoff import Corpus, export_vectors
from embed.embed_text import text_hash
from embed.export import restamp, to_parquet

NATIVE = "Qwen/Qwen3-Embedding-4B@abc1234#d2560"
NATIVE_DIM, DEPLOY_DIM = 16, 4  # 모양만 같으면 되므로 작게


def _npz(tmp_path, n=3):
    """bakeoff --save-vectors 가 내는 모양 — 해시는 **native 스탬프**로 만들어져 있다."""
    rng = np.random.default_rng(0)
    v = rng.normal(size=(n, NATIVE_DIM)).astype(np.float32)
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    texts = [f"장소{i} · 관광지 · 서울 · 개요 {i}" for i in range(n)]
    p = tmp_path / "vec.npz"
    np.savez_compressed(p, vectors=v, ids=np.array([str(100 + i) for i in range(n)]),
                        hashes=np.array([text_hash(NATIVE, t) for t in texts]),
                        texts=np.array(texts, dtype=object), model_ref=NATIVE, encode_s=1.0)
    return p, texts


def test_parquet_passes_the_real_push_validation(tmp_path):
    npz, texts = _npz(tmp_path)
    out = tmp_path / "v.parquet"
    ref, n = to_parquet(str(npz), str(out), DEPLOY_DIM)

    assert ref == "Qwen/Qwen3-Embedding-4B@abc1234#d4"  # 모델·리비전 유지, 차원만 바뀐다
    assert n == len(texts)
    df = pd.read_parquet(out)
    assert push.validate(df) == (ref, DEPLOY_DIM)  # 검사가 통과해야 첫 채움이 나간다
    assert np.allclose(np.linalg.norm(np.stack(df["vector"].map(np.asarray)), axis=1), 1.0, atol=1e-5)


def test_reusing_the_saved_hashes_is_rejected(tmp_path):
    """회귀 주입: npz 의 해시를 그대로 쓰면(= 차원 꼬리가 옛것) push 가 막아야 한다."""
    npz, texts = _npz(tmp_path)
    d = np.load(npz, allow_pickle=True)
    v = d["vectors"][:, :DEPLOY_DIM].copy()
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    corpus = Corpus(ids=[str(i) for i in d["ids"]], texts=texts,
                    hashes=[str(h) for h in d["hashes"]], meta=[{} for _ in texts])
    bad = tmp_path / "bad.parquet"
    export_vectors(str(bad), restamp(NATIVE, DEPLOY_DIM), DEPLOY_DIM, corpus, v)
    with pytest.raises(ValueError, match="text_hash"):
        push.validate(pd.read_parquet(bad))


def test_restamp_rejects_a_non_stamp():
    with pytest.raises(ValueError):
        restamp("Qwen/Qwen3-Embedding-4B@abc1234", 1024)
