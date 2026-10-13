package com.kgd.search.domain.attraction.model

/**
 * 문서가 어떤 동행에 맞는가 — 원천 분류와 원천 체험 가능 연령에서 파생한다. 재색인이 계산해 `companions` 로 싣는다.
 *
 * 아이([AttractionCompanion.KIDS])는 둘 중 하나면 붙는다.
 * - 원천 소분류(`lclsSystm3`)가 아이를 대상으로 하는 시설이다 — 테마파크·동물원·수족관·어린이공원·과학관·체험마을·체험농장 등.
 * - 소개 원문의 체험 가능 연령(`expagerange*`)이 어린이·유아·아동·초등·children·kids·child 를 말한다.
 *
 * 「전연령」·「all ages」만으로는 붙이지 않는다 — 그 말은 아이를 위한 곳이라는 뜻이 아니라 제한이 없다는 뜻이라,
 * 반려견 공원 같은 곳까지 붙었다.
 */
object AttractionCompanionFit {

    /** 아이 대상 원천 소분류 — 코드는 원천 분류 코드표의 값이고 이름은 읽기용이다. */
    val KIDS_CATEGORIES: Set<String> = setOf(
        "AC050100", // 일반야영장
        "AC050200", // 오토캠핑장
        "EX070200", // 기타체험관광
        "EX030100", // 체험마을
        "EX030200", // 체험목장
        "EX030300", // 체험농장
        "EX030400", // 체험어장
        "EX010100", // 전통문화체험
        "EX020400", // 기타공예체험
        "VE020100", // 테마파크
        "VE020300", // 동물원
        "VE020400", // 수족관/아쿠아리움
        "VE030300", // 어린이공원
        "VE070500", // 과학관
    )

    /** 체험 가능 연령 키의 머리 — 유형마다 꼬리가 다르다(`expagerange` · `expagerangeleports`). */
    private const val AGE_RANGE_KEY_PREFIX = "expagerange"

    private val KIDS_AGE = Regex("어린이|유아|아동|초등|children|kids|child", RegexOption.IGNORE_CASE)

    /** [intro] 는 소개 원문(introRaw)을 푼 키·값이다. 원문이 없거나 깨졌으면 빈 맵을 넘긴다. */
    fun of(lclsSystm3: String?, intro: Map<String, String?>): Set<AttractionCompanion> {
        val byCategory = lclsSystm3 != null && lclsSystm3 in KIDS_CATEGORIES
        val byAge = intro.any { (key, value) -> key.startsWith(AGE_RANGE_KEY_PREFIX) && value != null && KIDS_AGE.containsMatchIn(value) }
        return if (byCategory || byAge) setOf(AttractionCompanion.KIDS) else emptySet()
    }
}
