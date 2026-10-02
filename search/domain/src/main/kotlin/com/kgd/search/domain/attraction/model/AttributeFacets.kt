package com.kgd.search.domain.attraction.model

import java.time.DayOfWeek

/**
 * 속성 패싯 선택 — **긍정 값만** 담는다. 「주차 불가」나 `UNKNOWN` 으로 거르는 길은 이 타입에 없다.
 * [today] 는 「오늘 정기휴무 아님」 필터와 그 건수가 쓰는 KST 요일이다(선택하지 않아도 건수는 센다).
 * 속성 사이는 AND, [pet] 안의 값끼리는 OR 다.
 */
data class AttributeSelection(
    val today: DayOfWeek,
    val openToday: Boolean = false,
    val parking: Boolean = false,
    val creditCard: Boolean = false,
    val strollerRental: Boolean = false,
    val pet: Set<PetPolicy> = emptySet(),
    val freeAdmission: Boolean = false,
    /** 무장애 긍정 코드 — [BarrierFreeInfo.FILTER_CODES] 안에서만. 코드 사이는 AND(각 칩이 한 속성이다). */
    val barrierFree: Set<String> = emptySet(),
    /** 웰니스 테마가 있는 곳. */
    val wellness: Boolean = false,
) {
    init {
        require(PetPolicy.UNKNOWN !in pet) { "반려동물 필터는 긍정 값만 받는다" }
        require(barrierFree.all { it in BarrierFreeInfo.FILTER_CODES }) { "무장애 필터는 연 코드만 받는다: $barrierFree" }
    }

    companion object {
        /** 반려동물 칩 둘 — 둘 다 긍정 값이다(동반 가능 · 일부 구역 가능). */
        val PET_CHOICES: List<PetPolicy> = listOf(PetPolicy.ALLOWED, PetPolicy.PARTIAL)
    }
}

/**
 * 속성 값별 건수. 각 건수는 **자기 속성의 선택만 빼고** 나머지 선택과 구조 필터를 반영한 값이다 —
 * 「이 조건을 더하면 몇 곳」. `UNKNOWN`·부정 값의 건수는 세지 않는다.
 */
data class AttributeFacetCounts(
    val openToday: Long,
    val parking: Long,
    val creditCard: Long,
    val strollerRental: Long,
    val pet: Map<PetPolicy, Long>,
    val freeAdmission: Long,
    /** 무장애 코드별 건수 — [BarrierFreeInfo.FILTER_CODES] 순서. */
    val barrierFree: Map<String, Long> = emptyMap(),
    val wellness: Long = 0,
)
