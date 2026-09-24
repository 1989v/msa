package com.kgd.codedictionary.domain.concept.model

/**
 * 개념의 **역할** 축. 주제 분류(`ConceptCategory`)·난이도(`ConceptLevel`)와 직교한다 —
 * BM25 는 category ALGORITHM 이면서 kind MECHANISM 이다.
 *
 * 판정은 개념 자체의 성격으로만 한다. 어디에 소개되는가(용어 사전·장치 아래)는 배치(CONTAINS)와
 * USES 가 표현하고 kind 를 바꾸지 않는다. 경계: 시스템이 **돌리거나 고르는 것**이면 MECHANISM,
 * **알아야 읽히는 이름**(구조·값·정의·산출물)이면 TERM.
 */
enum class ConceptKind {
    /** 무엇이 들어오나 — 루트와 진입점 */
    DOMAIN,

    /** 무엇을 하나 — 활동. 산출물·묶음은 STAGE 가 아니다 */
    STAGE,

    /** 무엇으로 하나 — 시스템이 실행·설정하는 것 */
    MECHANISM,

    /** 이해에 필요한 이름. 자리는 용어 사전 가지뿐이고 CONTAINS 부모는 정확히 하나다 */
    TERM,

    /** 이름 붙은 구체물 — 제품·라이브러리·사전·말뭉치 */
    TECHNOLOGY,

    /** 피하려는 상태 */
    PROBLEM,

    /** 재는 값 */
    METRIC,
}
