"""KATEC(TM128) → WGS84 좌표 변환 (ADR-0081 §4).

오피넷 응답의 `GIS_X_COOR`/`GIS_Y_COOR` 는 위경도가 아니라 **KATEC** 이다. 값이 십만 단위라
위경도로 착각해도 즉시 안 들키고, 그대로 저장하면 지도의 핀만 전부 엉뚱한 자리에 찍힌다.

pyproj 를 쓰지 않는 이유는 place/ingest 와 같다 — 이 잡의 서드파티 의존이 0이고,
pyproj 는 PROJ 데이터까지 끌고 와 이미지가 수십 MB 커진다. 변환식은 표준 횡축 메르카토르
역변환 + Molodensky 데이텀 변환이라 여기서 직접 편다.

KATEC 파라미터
    타원체      Bessel 1841
    투영        Transverse Mercator, 원점 (38°N, 128°E), k0 = 0.9999
    가원점      FE 400,000 · FN 600,000
    데이텀      Korean Datum 1985(Bessel) → WGS84
"""
from __future__ import annotations

import math

# Bessel 1841 (KATEC 의 타원체)
BESSEL_A = 6377397.155
BESSEL_F = 1 / 299.1528128

# WGS84
WGS84_A = 6378137.0
WGS84_F = 1 / 298.257223563

# Bessel → WGS84 데이텀 이동량 (한국 지역). 이 셋이 빠지면 실제 위치에서 수백 m 어긋난다.
DX, DY, DZ = -146.43, 507.89, 681.46

# TM 투영 파라미터
LAT0 = math.radians(38.0)
LON0 = math.radians(128.0)
K0 = 0.9999
FALSE_EASTING = 400000.0
FALSE_NORTHING = 600000.0

# 변환 결과가 이 밖으로 나가면 입력이 KATEC 이 아니거나 x/y 가 뒤바뀐 것이다.
KOREA_BOUNDS = (32.0, 40.0, 123.0, 133.0)  # (min_lat, max_lat, min_lng, max_lng)


def _meridian_arc(lat: float, a: float, e2: float) -> float:
    return a * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * lat
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * lat)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * lat)
        - (35 * e2**3 / 3072) * math.sin(6 * lat)
    )


def katec_to_bessel(x: float, y: float) -> tuple[float, float]:
    """KATEC 평면좌표 → Bessel 타원체상의 (위도, 경도) 도(degree). 데이텀 변환 전 단계."""
    a = BESSEL_A
    e2 = 2 * BESSEL_F - BESSEL_F**2
    ep2 = e2 / (1 - e2)

    m = _meridian_arc(LAT0, a, e2) + (y - FALSE_NORTHING) / K0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))

    lat1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )

    c1 = ep2 * math.cos(lat1) ** 2
    t1 = math.tan(lat1) ** 2
    n1 = a / math.sqrt(1 - e2 * math.sin(lat1) ** 2)
    r1 = a * (1 - e2) / (1 - e2 * math.sin(lat1) ** 2) ** 1.5
    d = (x - FALSE_EASTING) / (n1 * K0)

    lat = lat1 - (n1 * math.tan(lat1) / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720
    )
    lon = LON0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120
    ) / math.cos(lat1)

    return math.degrees(lat), math.degrees(lon)


def bessel_to_wgs84(lat_deg: float, lon_deg: float, height: float = 0.0) -> tuple[float, float]:
    """Molodensky 데이텀 변환 — Bessel(한국측지계 1985) → WGS84."""
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)

    a = BESSEL_A
    f = BESSEL_F
    da = WGS84_A - BESSEL_A
    df = WGS84_F - BESSEL_F
    e2 = 2 * f - f**2
    b = a * (1 - f)

    sin_lat, cos_lat = math.sin(lat), math.cos(lat)
    sin_lon, cos_lon = math.sin(lon), math.cos(lon)
    w = math.sqrt(1 - e2 * sin_lat**2)
    rn = a / w
    rm = a * (1 - e2) / w**3

    dlat = (
        -DX * sin_lat * cos_lon
        - DY * sin_lat * sin_lon
        + DZ * cos_lat
        + da * rn * e2 * sin_lat * cos_lat / a
        + df * (rm * (a / b) + rn * (b / a)) * sin_lat * cos_lat
    ) / (rm + height)
    dlon = (-DX * sin_lon + DY * cos_lon) / ((rn + height) * cos_lat)

    return math.degrees(lat + dlat), math.degrees(lon + dlon)


def katec_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """오피넷이 준 KATEC 좌표를 지도에 찍을 수 있는 WGS84 (위도, 경도) 로."""
    lat, lon = katec_to_bessel(x, y)
    return bessel_to_wgs84(lat, lon)


def within_korea(lat: float, lng: float) -> bool:
    """변환 결과가 한반도 범위 안인가 — x/y 뒤바뀜이나 미변환을 잡는 마지막 그물."""
    min_lat, max_lat, min_lng, max_lng = KOREA_BOUNDS
    return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng
