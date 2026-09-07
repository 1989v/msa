package com.kgd.search.domain.queryvector.port

/**
 * 질의 인코더 (ADR-0090 개정 2026-09-08) — 상주 사이드카가 질의를 벡터로 바꾼다.
 *
 * **실패는 예외가 아니라 null 이다.** 인코더가 죽어도 검색은 BM25 로 답해야 하므로,
 * 호출자가 try/catch 를 잊어 검색 전체를 떨어뜨리는 일이 없도록 계약에서 막는다.
 */
interface QueryEncoderPort {
    /** 실패·타임아웃이면 null. 반환 벡터는 **정규화(L2)된 상태**여야 한다. */
    fun encode(normalized: String): List<Float>?

    /** 사이드카가 실제로 서빙 중인 스탬프. 설정과 다르면 벡터 레그를 켜지 않는다. */
    fun modelRef(): String?
}
