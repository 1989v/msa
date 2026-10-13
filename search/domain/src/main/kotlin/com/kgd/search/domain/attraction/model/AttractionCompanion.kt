package com.kgd.search.domain.attraction.model

/**
 * 동행 대상 — 질의 이해가 읽은 「누구와 가는가」와, 문서가 그 동행에 맞는지([AttractionCompanionFit])가 같은 값을 쓴다.
 *
 * 지금은 아이 하나뿐이다. 연인·부모님·친구·혼자는 원천에 판정 근거가 없어 넣지 않았고,
 * 반려동물은 원천의 동반 가능 여부(`petPolicy`)가 따로 맡는다.
 */
enum class AttractionCompanion {
    KIDS,
}
