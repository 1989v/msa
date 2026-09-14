package com.kgd.analytics.application.popularity.usecase

import java.time.LocalDate

/**
 * 원장(`events`)을 하루치로 접어 `attraction_popularity_daily` 에 넣는다 (ADR-0095).
 *
 * 소비자(place-ingest 의 links 잡)는 **이 표만** 읽는다. 공용 원장에 직접 붙이면 원장 스키마가
 * 바뀔 때 조용히 깨진다.
 */
interface AggregateAttractionPopularityUseCase {
    fun aggregate(day: LocalDate): Int
}
