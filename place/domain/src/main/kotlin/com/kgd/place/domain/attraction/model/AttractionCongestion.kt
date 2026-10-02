package com.kgd.place.domain.attraction.model

import java.time.LocalDate

/**
 * 관광지 집중률 — 한국관광공사 빅데이터 `TatsCnctrRateService` 의 (시군구, 관광지 이름) 하나와 그 앞 30일 예측.
 *
 * 원천에는 TourAPI contentId 가 없어 이름 + 시군구로 국문 관광지에 잇는다(place-ingest `name_match.py`, 연관 관광지와 공용).
 * [ratesRaw] 는 원천 행(예측일마다 한 행, 7키) 배열 원문이고, 예측일 범위와 매칭 결과([attractionId] · [matchMethod])가 파생 값이다.
 * 못 이은 이름도 저장한다 — 원천 전부 적재(data-sources.md §0 ①)이고, 매칭 규칙이 바뀌면 원문에서 다시 잇는다.
 */
data class AttractionCongestion(
    val signguCd: String,
    val tAtsNm: String,
    val areaCd: String,
    val areaNm: String?,
    val signguNm: String?,
    val ratesRaw: String,
    val firstYmd: LocalDate,
    val lastYmd: LocalDate,
    val attractionId: Long?,
    val matchMethod: NameMatch,
) {
    init {
        require(SIGUNGU_CODE.matches(signguCd)) { "시군구 코드는 5자리 숫자여야 합니다: $signguCd" }
        require(tAtsNm.isNotBlank()) { "관광지 이름이 비었습니다: $signguCd" }
        require(!firstYmd.isAfter(lastYmd)) { "예측일 범위가 뒤집혔습니다: $tAtsNm $firstYmd > $lastYmd" }
        require((attractionId != null) == matchMethod.linked) { "매칭 방법과 관광지 id 가 어긋납니다: $tAtsNm $matchMethod $attractionId" }
    }

    companion object {
        private val SIGUNGU_CODE = Regex("\\d{5}")
    }
}

/** 예측일 하루 — [rate] 는 원천 `cnctrRate` 값 그대로(0~100). */
data class CongestionDay(val date: LocalDate, val rate: Double)

/** 한 관광지의 집중률 예측(읽기 모델). [days] 는 예측일 순이다. */
data class CongestionForecast(
    val attractionId: Long,
    val matchMethod: NameMatch,
    val lastYmd: LocalDate,
    val days: List<CongestionDay>,
) {
    companion object {
        /**
         * 원천 이름 둘 이상이 한 관광지에 이어졌을 때(예: 정확 하나 + 정규화 하나) 하나만 고른다 —
         * 매칭이 더 확실한 쪽(정확 > 정규화 > 포함), 같으면 예측이 더 멀리 가는 쪽.
         */
        fun preferred(forecasts: List<CongestionForecast>): Map<Long, CongestionForecast> =
            forecasts.groupBy { it.attractionId }.mapValues { (_, same) ->
                same.sortedWith(compareBy<CongestionForecast> { it.matchMethod.ordinal }.thenByDescending { it.lastYmd }).first()
            }
    }
}
