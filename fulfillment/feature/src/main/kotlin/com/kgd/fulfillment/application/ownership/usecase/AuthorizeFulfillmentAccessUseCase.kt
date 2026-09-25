package com.kgd.fulfillment.application.ownership.usecase

/** 이행 REST 권한 판정 — 판정 규칙은 구현([com.kgd.fulfillment.application.ownership.service.FulfillmentAccessAuthorizer]) 문서 참조 */
interface AuthorizeFulfillmentAccessUseCase {
    /** 이행 생성 — 어드민만 */
    fun requireAdmin(requester: FulfillmentRequester)

    /** 전이·취소 — 라인 전부가 요청 판매자 상품 */
    fun requireWrite(requester: FulfillmentRequester, fulfillmentId: Long)

    /** 조회 — 라인 하나라도 요청 판매자 상품 */
    fun requireRead(requester: FulfillmentRequester, fulfillmentId: Long)

    /** 주문의 이행 중 읽을 수 있는 id. 어드민은 null(거르지 않는다). 판매자에게 하나도 없으면 403 */
    fun readableIdsOfOrder(requester: FulfillmentRequester, orderId: Long): Set<Long>?
}
