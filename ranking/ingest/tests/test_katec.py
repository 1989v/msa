#!/usr/bin/env python3
"""KATEC → WGS84 변환의 골든 좌표 검증 (ADR-0081 §4).

    cd ranking/ingest && python3 -m tests.test_katec

**기대값은 이 코드가 만든 것이 아니다.** PROJ(pyproj) 로 같은 KATEC 정의를 태워 뽑은 값이고,
전 국토에 흩어진 7개 점에서 두 구현의 차이는 4cm 이하였다. 독립 구현과 맞춰본 값이라야
"변환이 맞다"의 근거가 된다 — 자기 코드로 만든 기대값은 아무것도 증명하지 않는다.

이 변환이 틀리면 값은 그럴듯한 채로 지도의 핀만 전부 어긋난다. 타입 검사도 빌드도 안 잡는다.
"""
from __future__ import annotations

import math
import unittest

from src.katec import katec_to_bessel, katec_to_wgs84, within_korea

# (x, y, 기대 위도, 기대 경도) — PROJ 산출값
GOLDEN = [
    (400000, 600000, 38.0026988, 127.9977536),   # 투영 원점
    (313000, 552000, 37.5660736, 127.0129466),   # 수도권
    (383000, 336000, 35.6234115, 127.8101479),   # 전북
    (255000, 415000, 36.3246604, 126.3828956),   # 충남 서해
    (443000, 672000, 38.6503537, 128.4917369),   # 강원 북부
    (340000, 258000, 34.9186659, 127.3411776),   # 전남 남해
    (198000, 392000, 36.1072562, 125.7543787),   # 서해 먼바다
]

TOLERANCE_M = 1.0


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return math.hypot((lat1 - lat2) * 111320, (lng1 - lng2) * 111320 * math.cos(math.radians(lat1)))


class KatecConversionTest(unittest.TestCase):

    def test_golden_points_match_proj(self):
        for x, y, want_lat, want_lng in GOLDEN:
            with self.subTest(x=x, y=y):
                lat, lng = katec_to_wgs84(x, y)
                self.assertLess(_distance_m(lat, lng, want_lat, want_lng), TOLERANCE_M)

    def test_projection_origin_is_exact_before_datum_shift(self):
        """가원점 (400000, 600000) 은 정의상 Bessel 상의 정확히 (38N, 128E) 다."""
        lat, lng = katec_to_bessel(400000, 600000)
        self.assertAlmostEqual(lat, 38.0, places=6)
        self.assertAlmostEqual(lng, 128.0, places=6)

    def test_datum_shift_is_applied(self):
        """데이텀 변환을 빼먹으면 Bessel 값이 그대로 나온다 — 한국에서 300m 이상 어긋난다."""
        bessel_lat, bessel_lng = katec_to_bessel(313000, 552000)
        wgs_lat, wgs_lng = katec_to_wgs84(313000, 552000)
        shift = _distance_m(bessel_lat, bessel_lng, wgs_lat, wgs_lng)
        self.assertGreater(shift, 100.0)
        self.assertLess(shift, 800.0)

    def test_axes_are_not_swapped(self):
        """x 는 동쪽, y 는 북쪽. 뒤바꿔 넣는 것이 이 변환의 가장 흔한 실수다."""
        base_lat, base_lng = katec_to_wgs84(300000, 500000)
        east_lat, east_lng = katec_to_wgs84(340000, 500000)
        north_lat, north_lng = katec_to_wgs84(300000, 540000)
        self.assertGreater(east_lng, base_lng)
        self.assertAlmostEqual(east_lat, base_lat, delta=0.05)
        self.assertGreater(north_lat, base_lat)
        self.assertAlmostEqual(north_lng, base_lng, delta=0.05)

    def test_within_korea_guard(self):
        for x, y, *_ in GOLDEN:
            lat, lng = katec_to_wgs84(x, y)
            self.assertTrue(within_korea(lat, lng), f"({x},{y}) → ({lat},{lng})")
        # 변환하지 않은 원시 KATEC 값을 위경도로 넘기면 걸러져야 한다
        self.assertFalse(within_korea(400000.0, 600000.0))


if __name__ == "__main__":
    unittest.main()
