package com.kgd.wishlist.application.share.usecase

/**
 * 단축 주소 `/c/{rest}` 의 목적지 (ADR-0107 §5). DB 를 보지 않는다.
 *
 * 목적지 호스트는 항상 설정의 단축 주소 호스트다 — 요청에서 호스트를 얻지 않는다.
 */
interface ResolveCollectionShortLinkUseCase {
    /** @param rest `/c/` 뒤의 나머지 경로 */
    fun resolve(rest: String): String
}
