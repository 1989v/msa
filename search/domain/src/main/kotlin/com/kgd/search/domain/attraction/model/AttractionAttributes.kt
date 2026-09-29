package com.kgd.search.domain.attraction.model

import java.time.DayOfWeek

/**
 * TourAPI 원문에서 뽑은 방문 속성. 재색인 때 [AttractionAttributeParser] 가 계산한다.
 *
 * 모든 속성은 `UNKNOWN` 을 명시값으로 갖는다. 원문이 없거나 해석할 수 없는 것을 부정으로 바꾸면
 * 「주차 불가」처럼 사실이 아닌 말을 하게 되고, 필터가 모르는 곳을 걸러 버린다.
 */
data class AttractionAttributes(
    val regularClosure: RegularClosure,
    val parking: Availability,
    val petPolicy: PetPolicy,
    val creditCard: Availability,
    val strollerRental: Availability,
    val freeAdmission: Admission,
    /** 이 결과를 만든 해석 규칙의 판. 규칙을 고치면 올리고, 다음 재색인이 전량을 다시 계산한다. */
    val parserVersion: Int = AttractionAttributeParser.VERSION,
)

/** 정기휴무. 「매주 쉬는 요일이 없다」와 「모른다」를 다른 값으로 둔다. */
sealed interface RegularClosure {
    /** 연중무휴. */
    data object AlwaysOpen : RegularClosure

    /**
     * 매주 쉬는 요일을 안다. 빈 집합은 명절·공휴일만 쉬는 곳이다 — 요일 기준으로는 매일 연다.
     * 명절·공휴일은 요일이 아니라 날짜라 여기 넣지 않는다.
     */
    data class Weekly(val closedDays: Set<DayOfWeek>) : RegularClosure

    /** 원문이 없거나 조건부(격주·월 1회·공휴일 다음날 등)라 요일을 확정할 수 없다. */
    data object Unknown : RegularClosure
}

enum class Availability { YES, NO, UNKNOWN }

/** 반려동물 동반. 원천 값에 「불가」가 없어 부정 값을 두지 않는다 — 대응 표는 스펙 구현 문서 pet-policy-map.md. */
enum class PetPolicy { ALLOWED, PARTIAL, UNKNOWN }

enum class Admission { FREE, PAID, UNKNOWN }
