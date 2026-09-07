"""저장된 인코딩(npz) → 첫 채움 parquet.

`bakeoff --save-vectors` 는 **native 차원**으로 인코딩한 것을 그대로 저장한다. 배포는 그보다
작은 차원을 쓰므로(ADR-0090 D5: qwen3-4b 2560 → 1024) 여기서 자르고 다시 정규화한다.

**차원을 자르면 스탬프가 바뀌고, 스탬프가 바뀌면 text_hash 가 바뀐다.** 그래서 npz 의 해시를
그대로 쓰지 않고 배포 스탬프로 다시 만든다 — 그대로 쓰면 push 의 검사가 막는다.

  python -m embed.export --npz vec_ko_qwen3-4b_full.npz --dim 1024 --out vectors_ko.parquet
"""
from __future__ import annotations

import argparse
import re

import numpy as np

from .bakeoff import Corpus, export_vectors
from .embed_text import text_hash

_DIM_SUFFIX = re.compile(r"#d\d+$")


def restamp(ref: str, dim: int) -> str:
    """스탬프의 차원 꼬리만 바꾼다. 모델·리비전은 그대로다 — 같은 벡터 공간의 잘린 판이다."""
    if not _DIM_SUFFIX.search(ref):
        raise ValueError(f"스탬프 모양이 아니다(#d 로 끝나야 한다): {ref}")
    return _DIM_SUFFIX.sub(f"#d{dim}", ref)


def to_parquet(npz_path: str, out_path: str, dim: int) -> tuple[str, int]:
    """npz 를 배포 차원으로 잘라 parquet 으로. 반환은 (배포 스탬프, 건수)."""
    d = np.load(npz_path, allow_pickle=True)
    vecs = d["vectors"]
    if dim > vecs.shape[1]:
        raise ValueError(f"dim {dim} > 저장된 차원 {vecs.shape[1]}")
    ref = restamp(str(d["model_ref"]), dim)

    vecs = vecs[:, :dim].astype(np.float32).copy()
    vecs /= np.maximum(np.linalg.norm(vecs, axis=1, keepdims=True), 1e-9)

    texts = [str(t) for t in d["texts"]]
    corpus = Corpus(ids=[str(i) for i in d["ids"]], texts=texts,
                    hashes=[text_hash(ref, t) for t in texts],
                    meta=[{} for _ in texts])
    export_vectors(out_path, ref, dim, corpus, vecs)
    return ref, len(texts)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m embed.export")
    p.add_argument("--npz", required=True, help="bakeoff --save-vectors 가 낸 파일")
    p.add_argument("--dim", type=int, required=True, help="배포 차원 (ADR-0090: 1024)")
    p.add_argument("--out", required=True)
    a = p.parse_args(argv)
    ref, n = to_parquet(a.npz, a.out, a.dim)
    print(f"{n}건 · {ref} → {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
