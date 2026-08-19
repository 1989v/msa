package com.kgd.deal.domain.model

/**
 * 전시 상태 (ADR-0066 커머스 전시 상태 관례).
 *
 * 딜은 오퍼 수가 전시 서비스보다 훨씬 많고 교체가 잦다. [HOLD] 는 링크가 살아 있지만
 * 잠시 내릴 때 쓴다 — 행을 지우면 문구·링크·순서를 다시 입력해야 한다.
 */
enum class DisplayStatus {
    OPEN,
    PREOPEN,
    HOLD;

    val displayed: Boolean get() = this != HOLD
}

/**
 * 링크의 수익 유형 (ADR-0069). 이 값이 도메인의 축이다.
 *
 * 고지 의무는 **경제적 이해관계가 있는 링크에만** 붙는다. 전부 뭉뚱그려 고지하면
 * 수수료를 받지 않는 링크까지 광고로 읽혀, 고지의 목적(신뢰)과 반대로 간다.
 */
enum class RevenueType {
    /** 제휴 프로그램이 발급한 트래킹 URL — 유입→구매 시 수수료 */
    AFFILIATE,

    /** 제휴 없는 곳의 공개 혜택/프로모션 페이지 — 수익 없음 */
    PLAIN;

    /** 공정위 표시·광고 심사지침상 경제적 이해관계 공개 대상인가 */
    val requiresDisclosure: Boolean get() = this == AFFILIATE
}

/**
 * 링크 생존 점검 결과 (ADR-0069 §5).
 *
 * [UNKNOWN] 이 [BROKEN] 과 분리돼 있는 것이 핵심이다. HEAD 403/405/429 는 봇 차단 오탐이
 * 압도적이라 BROKEN 으로 찍으면 경고가 노이즈가 되고, 노이즈가 되는 순간 어드민이 무시하게 돼
 * 이 장치는 없는 것과 같아진다.
 */
enum class LinkStatus {
    OK,
    BROKEN,
    UNKNOWN,
}
