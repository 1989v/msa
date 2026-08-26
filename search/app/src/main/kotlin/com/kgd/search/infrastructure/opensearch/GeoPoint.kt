package com.kgd.search.infrastructure.opensearch

/**
 * OpenSearch `geo_point` 와이어 타입. `attractions`·`regions` 두 인덱스가 함께 쓴다.
 *
 * 한쪽 문서의 중첩 타입으로 두면 별개 인덱스가 남의 문서 정의에 묶인다 — attractions 를 손대면
 * regions 가 따라 깨졌다 (2026-08-26 분리).
 */
data class GeoPoint(val lat: Double = 0.0, val lon: Double = 0.0)
