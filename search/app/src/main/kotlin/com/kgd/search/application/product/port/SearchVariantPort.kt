package com.kgd.search.application.product.port

/**
 * 검색 랭킹 온라인 A/B 의 variant 해석 (ADR-0050 Phase 4).
 *
 * 실험이 꺼져 있거나 비로그인이면 null — 기본 ranking. 실험 서비스 호출 실패도 null 로
 * graceful degrade 한다. 어느 실험(id)을 보는지는 어댑터 설정이 안다.
 */
interface SearchVariantPort {
    fun resolveVariant(userId: String?): String?
}
