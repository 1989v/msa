"""벡터 표현이 서버와 같은지. 기준값은 **JVM 이 만든 것**이다 — 파이썬끼리 왕복시키면 엔디안이 뒤집혀도 통과한다.

만든 방법(재현 가능):
    jshell> ByteBuffer.allocate(n*4).order(ByteOrder.LITTLE_ENDIAN) … Base64.getEncoder().encodeToString(...)
서버 `AttractionEmbeddingInternalController.encode` 와 같은 클래스·같은 순서다.
"""
from __future__ import annotations

import struct

import numpy as np
import pytest

from embed import vectors

# (벡터, JVM 이 낸 base64)
JVM_GOLDEN = [
    ([1.0, 0.0, 0.0, 0.0], "AACAPwAAAAAAAAAAAAAAAA=="),
    ([0.5, 0.5, 0.5, 0.5], "AAAAPwAAAD8AAAA/AAAAPw=="),
    ([-0.6, 0.8], "mpkZv83MTD8="),
]


@pytest.mark.parametrize("vec,expected", JVM_GOLDEN)
def test_encode_matches_jvm(vec, expected):
    assert vectors.encode(vec) == expected


@pytest.mark.parametrize("vec,encoded", JVM_GOLDEN)
def test_decode_matches_jvm(vec, encoded):
    got = vectors.decode(encoded, len(vec))
    assert np.allclose(got, np.array(vec, dtype=np.float32))


def test_encode_is_little_endian_by_stdlib():
    """numpy 를 믿지 않고 stdlib `struct` 로도 같은 바이트가 나오는지 — 구현이 둘 다 틀릴 확률을 줄인다."""
    vec = [1.5, -2.25, 0.125]
    import base64
    assert vectors.encode(vec) == base64.b64encode(struct.pack("<3f", *vec)).decode()


def test_decode_rejects_wrong_length():
    with pytest.raises(ValueError, match="dim 과 맞지 않습니다"):
        vectors.decode(JVM_GOLDEN[0][1], 3)


def test_decode_result_is_writable():
    """frombuffer 뷰를 그대로 내면 나중 대입이 터진다."""
    out = vectors.decode(JVM_GOLDEN[0][1], 4)
    out[0] = 0.5
    assert out[0] == pytest.approx(0.5)


def test_encode_rejects_non_1d_and_empty():
    with pytest.raises(ValueError, match="1차원"):
        vectors.encode([[1.0, 0.0], [0.0, 1.0]])
    with pytest.raises(ValueError, match="빈 벡터"):
        vectors.encode([])


def test_check_normalized_accepts_unit_and_rejects_scaled():
    vectors.check_normalized([0.6, 0.8])
    with pytest.raises(ValueError, match="정규화"):
        vectors.check_normalized([3.0, 4.0])


def test_check_normalized_catches_nan_before_norm():
    """NaN 은 `nan != nan` 이라 노름 비교만으로는 새어 나간다 — harrier-270m fp16 에서 실제로 났다."""
    with pytest.raises(ValueError, match="NaN/Inf"):
        vectors.check_normalized([float("nan"), 0.0])


def test_tolerance_matches_domain():
    """도메인 `AttractionEmbedding.create` 와 같은 0.01 — 여기가 더 느슨하면 서버가 배치를 통째로 거부한다."""
    assert vectors.NORM_TOLERANCE == 0.01
