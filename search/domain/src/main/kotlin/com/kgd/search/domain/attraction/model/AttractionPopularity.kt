package com.kgd.search.domain.attraction.model

/**
 * 키워드 없는 목록(브라우즈)의 정렬 신호 (ADR-0065 P2 후속).
 *
 * 지금까지 브라우즈 순서는 사실상 문자열 id 순이었다 — matchAll 은 전 문서 동점이고
 * tiebreaker 가 keyword `id` 라 "1", "10", "100" 사전순으로 나갔다. 특히 영문 목록은
 * 이미지·개요 없는 레코드가 첫 화면을 채웠다.
 *
 * 방문 지표가 아직 없어 **레코드 완결성**을 신호로 쓴다 — 이미지·개요·전화가 갖춰진
 * 레코드가 "보여줄 준비가 된" 레코드고, ko/en 에 같은 공식이 걸려 언어 대칭이다.
 *
 *     base 1.0 + 이미지 1.0 + 개요(100자 미만 0.5 / 400자 미만 1.0 / 그 이상 1.5) + 전화 0.2
 *     범위 [1.0, 3.7]
 *
 * 개요를 길이 구간으로 나눈 이유: 길이는 품질의 근사일 뿐이라 연속값으로 쓰면 긴 개요가
 * 한없이 유리해진다. 전화 0.2 는 tie-break 수준 — 전화 유무는 관광 가치와 상관이 약하다.
 * 색인 시점에 계산해 `popularityScore` 로 싣는다 (AttractionApiReindexTasklet).
 */
object AttractionPopularity {

    const val BASE = 1.0
    const val IMAGE = 1.0
    const val TEL = 0.2

    fun score(imageUrl: String?, overview: String?, tel: String?): Double {
        var score = BASE
        if (!imageUrl.isNullOrBlank()) score += IMAGE
        val overviewLength = overview?.trim()?.length ?: 0
        score += when {
            overviewLength == 0 -> 0.0
            overviewLength < 100 -> 0.5
            overviewLength < 400 -> 1.0
            else -> 1.5
        }
        if (!tel.isNullOrBlank()) score += TEL
        return score
    }
}
