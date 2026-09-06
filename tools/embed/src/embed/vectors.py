"""벡터 직렬화 — float32 little-endian 바이트의 base64.

서버(`AttractionEmbeddingInternalController.encode`/`decode`)와 **같은 표현**이다. 한쪽만 바꾸면
운이 좋으면 길이 검사에 걸려 400 이 나고, 운이 나쁘면 엔디안이 어긋난 벡터가 조용히 들어간다
(검색 품질만 무너지고 아무도 에러를 못 본다).

정규화 자체는 `bakeoff.encode` 한 곳이 한다(자른 뒤 재정규화까지). 여기는 **검사만** 한다 —
같은 일을 두 곳에서 하면 한쪽만 고쳐졌을 때 조용히 어긋난다.

정규화 검사를 도구가 **먼저** 하는 이유: 업서트는 요청 단위 all-or-nothing 이라, 500건 중 한 건이
정규화를 벗어나면 나머지 499건도 함께 거부된다. 어느 건이 왜 걸렸는지는 여기서 알려주는 편이 빠르다.
"""
from __future__ import annotations

import base64

import numpy as np

#: 도메인 `AttractionEmbedding.create` 의 허용 오차와 같은 값. 여기가 더 느슨하면 서버가 거부한다.
NORM_TOLERANCE = 0.01

#: float32 little-endian. 빅엔디안 기계에서도 이 표기가 바이트 순서를 고정한다.
DTYPE = np.dtype("<f4")


def encode(vector) -> str:
    """1차원 벡터 → base64. 서버는 `dim * 4` 바이트인지 검사한다."""
    v = np.asarray(vector, dtype=DTYPE)
    if v.ndim != 1:
        raise ValueError(f"1차원이어야 합니다: shape={v.shape}")
    if v.size == 0:
        raise ValueError("빈 벡터는 보낼 수 없습니다")
    return base64.b64encode(np.ascontiguousarray(v).tobytes()).decode("ascii")


def decode(b64: str, dim: int) -> np.ndarray:
    """base64 → 1차원 float32. 길이가 `dim` 과 다르면 거부한다(서버와 같은 검사)."""
    raw = base64.b64decode(b64)
    if len(raw) != dim * 4:
        raise ValueError(f"벡터 바이트 길이가 dim 과 맞지 않습니다: {len(raw)} != {dim * 4}")
    # frombuffer 는 읽기 전용 뷰라 그대로 넘기면 나중에 대입이 터진다. 복사해서 낸다.
    return np.frombuffer(raw, dtype=DTYPE).copy()


def check_normalized(vector, *, label: str = "", tolerance: float = NORM_TOLERANCE) -> None:
    """L2 노름이 1 근처인지, 그리고 NaN/Inf 가 없는지. 둘 다 서버가 거부하는 조건이다.

    NaN 은 fp16 로 돌린 모델에서 실제로 났다(harrier-270m, MPS, 2026-09-05). 노름 검사만으로는
    `nan != nan` 이라 통과하는 경로가 생겨서, 유한성부터 본다.
    """
    v = np.asarray(vector, dtype=np.float32)
    where = f"{label}: " if label else ""
    if not np.isfinite(v).all():
        raise ValueError(f"{where}벡터에 NaN/Inf 가 있습니다 (fp16 로 돌린 모델이면 fp32 로 내려보세요)")
    norm = float(np.linalg.norm(v))
    if abs(norm - 1.0) >= tolerance:
        raise ValueError(f"{where}벡터가 L2 정규화돼 있지 않습니다: {norm:.6f}")
