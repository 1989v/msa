package com.kgd.analytics.application.popularity.usecase

import java.time.LocalDate

/**
 * 원장(`events`)을 하루치로 접어 `attraction_popularity_daily` 에 넣는다 (ADR-0095).
 *
 * 소비자(place-ingest 의 links 잡, search 관광지 재색인)는 **이 표만** 읽는다. 공용 원장에 직접 붙이면
 * 원장 스키마가 바뀔 때 조용히 깨진다.
 */
interface AggregateAttractionPopularityUseCase {
    fun aggregate(day: LocalDate): Int

    /**
     * KST 어제부터 거꾸로 [days] 일을 다시 접는다. 날짜마다 지우고 넣으므로 몇 번을 돌려도 같다.
     * 표에 컬럼이 늘었을 때(V007) 과거 날짜를 채우는 데 쓴다.
     *
     * @return 날짜별 적재 행 수 (최근 날짜부터)
     */
    fun reaggregateRecent(days: Int): Map<LocalDate, Int>

    companion object {
        /** 원장 보존기간(ADR-0077 · V005 TTL)보다 오래된 날짜는 원장이 비어 있어 접으면 0행이 된다. */
        const val MAX_REAGGREGATE_DAYS = 90
    }
}
