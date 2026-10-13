package com.kgd.search.domain.attraction.model

import kotlin.math.ln
import kotlin.math.max

/**
 * 소개문 고유도 — 같은 소개문을 여러 문서가 나눠 쓰면 그 문서들의 순위 계수를 낮춘다.
 *
 * 브랜드 지점은 본사 문구를 지점마다 그대로 실어 온다. 영문 색인은 15,300건에 소개문 종류가 6,670개뿐이고(2026-10-13 실측),
 * 그 문구가 질의 뜻에 맞으면 같은 브랜드 지점들이 목록을 채운다. 재색인 1차 훑기가 언어별로 같은 [key] 를 쓰는 활성 문서 수 n 을 세고,
 *
 *     weight(n) = 1 / (1 + ln n)      — n=1 이면 1.0, n=5 면 약 0.38, n=100 이면 약 0.18
 *
 * 을 문서에 싣는다. 검색이 두 레그 모두에 곱한다. 소개문이 비면 세지 않고 1.0 이다.
 */
object AttractionContentUniqueness {

    /** 같은 소개문으로 보는 길이 — 지점명만 끝에 덧붙인 문구도 같게 본다. */
    const val KEY_CHARS = 300

    /** 비교 열쇠 — 앞뒤 공백을 뗀 앞 [KEY_CHARS] 자. 비었으면 null(세지 않는다). */
    fun key(overview: String?): String? = overview?.trim()?.take(KEY_CHARS)?.ifEmpty { null }

    /** 같은 열쇠를 쓰는 문서 수 → 계수. 0 이하(세지 못한 문서)는 1 로 본다. */
    fun weight(sameCount: Int): Double = 1.0 / (1.0 + ln(max(1, sameCount).toDouble()))
}
